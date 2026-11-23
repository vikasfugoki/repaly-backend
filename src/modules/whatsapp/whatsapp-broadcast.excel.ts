import * as ExcelJS from 'exceljs';

export const MAX_BROADCAST_NUMBERS = 500;
export const MAX_BROADCAST_FILE_BYTES = 1024 * 1024; // 1 MB
export const MAX_BROADCAST_NAME_LENGTH = 100;

const DEFAULT_COUNTRY_CODE = '91';

export interface BroadcastRecipient {
  number: string; // digits only, with country code, e.g. "919876543210"
  name: string;
}

export interface InvalidBroadcastRow {
  row: number; // the row number the user sees in Excel
  value: string; // what was written in the number column
  reason: string;
}

export interface ParsedBroadcastExcel {
  valid: BroadcastRecipient[];
  invalid: InvalidBroadcastRow[];
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { code: 'BAD_REQUEST' });
}

/**
 * Returns the number with its country code, or null if it is not a usable phone
 * number. Text like "9.19876E+11" is refused rather than stripped to its digits,
 * because that would silently produce a different, real-looking number.
 */
export function normalizePhoneNumber(raw: string): string | null {
  const value = raw.trim();
  if (!/^[\d+\s()-]+$/.test(value)) return null;

  const digits = value.replace(/\D/g, '').replace(/^0+/, '');

  // A leading "+" means the country code is already there, so never add 91.
  if (value.startsWith('+')) {
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }
  if (digits.length === 10) return `${DEFAULT_COUNTRY_CODE}${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/**
 * Reads the first sheet of a base64 .xlsx file. Row 1 must be the header, with a
 * `number` column and an optional `name` column. Bad rows are returned in
 * `invalid`; only a file that cannot be used at all throws.
 */
export async function parseBroadcastExcel(
  fileBase64: string,
  requireName = false,
): Promise<ParsedBroadcastExcel> {
  // The browser's FileReader adds a "data:...;base64," prefix, so remove it.
  const base64 =
    typeof fileBase64 === 'string'
      ? fileBase64.replace(/^data:[^,]*,/, '')
      : '';
  const file = Buffer.from(base64, 'base64');
  if (file.length === 0) {
    throw badRequest('Excel file is required.');
  }
  if (file.length > MAX_BROADCAST_FILE_BYTES) {
    throw badRequest('Excel file must be 1 MB or smaller.');
  }

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file as any);
  } catch {
    throw badRequest(
      'Could not read the file. Please upload a valid .xlsx file.',
    );
  }

  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw badRequest('The Excel file has no sheet.');
  }

  let numberColumn = 0;
  let nameColumn = 0;
  sheet.getRow(1).eachCell((cell, column) => {
    const header = cell.text.trim().toLowerCase();
    if (header === 'number') numberColumn = column;
    if (header === 'name') nameColumn = column;
  });
  if (!numberColumn) {
    throw badRequest(
      'The first row of the Excel file must have a "number" column.',
    );
  }

  const valid: BroadcastRecipient[] = [];
  const invalid: InvalidBroadcastRow[] = [];
  const seen = new Set<string>();

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const value = row.getCell(numberColumn).text.trim().slice(0, 50);
    const name = nameColumn
      ? row.getCell(nameColumn).text.replace(/\s+/g, ' ').trim()
      : '';
    if (!value && !name) return;

    const number = normalizePhoneNumber(value);
    if (!value) {
      invalid.push({ row: rowNumber, value, reason: 'Number is missing' });
    } else if (!number) {
      invalid.push({ row: rowNumber, value, reason: 'Invalid number' });
    } else if (seen.has(number)) {
      invalid.push({ row: rowNumber, value, reason: 'Duplicate number' });
    } else if (requireName && !name) {
      invalid.push({ row: rowNumber, value, reason: 'Name is missing' });
    } else if (name.length > MAX_BROADCAST_NAME_LENGTH) {
      invalid.push({ row: rowNumber, value, reason: 'Name is too long' });
    } else {
      seen.add(number);
      valid.push({ number, name });
    }
  });

  if (valid.length + invalid.length > MAX_BROADCAST_NUMBERS) {
    throw badRequest(
      `The Excel file can have at most ${MAX_BROADCAST_NUMBERS} numbers.`,
    );
  }
  if (valid.length === 0) {
    throw badRequest('The Excel file has no valid numbers.');
  }

  return { valid, invalid };
}
