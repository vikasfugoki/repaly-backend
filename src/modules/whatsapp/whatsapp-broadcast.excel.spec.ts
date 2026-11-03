import { describe, expect, it } from '@jest/globals';
import * as ExcelJS from 'exceljs';
import {
  normalizePhoneNumber,
  parseBroadcastExcel,
} from './whatsapp-broadcast.excel';

async function makeExcel(rows: any[][]): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Sheet1').addRows(rows);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as any).toString('base64');
}

describe('normalizePhoneNumber', () => {
  it.each([
    ['9876543210', '919876543210'],
    ['09876543210', '919876543210'],
    ['919876543210', '919876543210'],
    ['+91 98765-43210', '919876543210'],
    ['(987) 654 3210', '919876543210'],
    ['0044 7911 123456', '447911123456'],
    ['+98 76543210', '9876543210'],
  ])('turns %s into %s', (raw, expected) => {
    expect(normalizePhoneNumber(raw)).toBe(expected);
  });

  it.each([
    '12345',
    'abc',
    '',
    '9.19876543E+11',
    '919876543210.0',
    '1234567890123456',
  ])('refuses %s', (raw) => {
    expect(normalizePhoneNumber(raw)).toBeNull();
  });
});

describe('parseBroadcastExcel', () => {
  it('reads numbers and names, whichever order the columns are in', async () => {
    const file = await makeExcel([
      ['Name', 'Number'],
      ['Rahul', 9876543210],
      ['Priya', '+91 98123 45678'],
    ]);

    await expect(parseBroadcastExcel(file)).resolves.toEqual({
      valid: [
        { number: '919876543210', name: 'Rahul' },
        { number: '919812345678', name: 'Priya' },
      ],
      invalid: [],
    });
  });

  it('works without a name column', async () => {
    const file = await makeExcel([['number'], [9876543210]]);

    const { valid } = await parseBroadcastExcel(file);

    expect(valid).toEqual([{ number: '919876543210', name: '' }]);
  });

  it('reports bad rows with the row number shown in Excel, and skips blank rows', async () => {
    const file = await makeExcel([
      ['number', 'name'],
      [9876543210, 'Rahul'],
      [],
      ['abc', 'Bad'],
      [null, 'No number'],
      ['919876543210', 'Same as Rahul'],
    ]);

    const { valid, invalid } = await parseBroadcastExcel(file);

    expect(valid).toHaveLength(1);
    expect(invalid).toEqual([
      { row: 4, value: 'abc', reason: 'Invalid number' },
      { row: 5, value: '', reason: 'Number is missing' },
      { row: 6, value: '919876543210', reason: 'Duplicate number' },
    ]);
  });

  it('accepts a file with the browser data prefix', async () => {
    const file = await makeExcel([['number'], [9876543210]]);

    const { valid } = await parseBroadcastExcel(
      `data:application/vnd.ms-excel;base64,${file}`,
    );

    expect(valid).toHaveLength(1);
  });

  it('marks rows without a name invalid only when the template needs one', async () => {
    const file = await makeExcel([
      ['number', 'name'],
      [9876543210, 'Rahul'],
      [9812345678, ''],
    ]);

    const withName = await parseBroadcastExcel(file, true);
    expect(withName.valid).toHaveLength(1);
    expect(withName.invalid).toEqual([
      { row: 3, value: '9812345678', reason: 'Name is missing' },
    ]);

    const withoutName = await parseBroadcastExcel(file);
    expect(withoutName.valid).toHaveLength(2);
  });

  it('marks a very long name invalid', async () => {
    const file = await makeExcel([
      ['number', 'name'],
      [9876543210, 'Rahul'],
      [9812345678, 'x'.repeat(101)],
    ]);

    const { invalid } = await parseBroadcastExcel(file);

    expect(invalid).toEqual([
      { row: 3, value: '9812345678', reason: 'Name is too long' },
    ]);
  });

  it('accepts exactly 500 numbers and refuses 501', async () => {
    const rows = (count: number) => [
      ['number'],
      ...Array.from({ length: count }, (_, i) => [9000000000 + i]),
    ];

    const { valid } = await parseBroadcastExcel(await makeExcel(rows(500)));
    expect(valid).toHaveLength(500);

    await expect(
      parseBroadcastExcel(await makeExcel(rows(501))),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'The Excel file can have at most 500 numbers.',
    });
  });

  it.each([
    ['an empty body', '', 'Excel file is required.'],
    [
      'a file that is not Excel',
      Buffer.from('hello').toString('base64'),
      'Could not read the file. Please upload a valid .xlsx file.',
    ],
    [
      'a file over 1 MB',
      Buffer.alloc(1024 * 1024 + 1).toString('base64'),
      'Excel file must be 1 MB or smaller.',
    ],
  ])('refuses %s', async (_label, file, message) => {
    await expect(parseBroadcastExcel(file)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message,
    });
  });

  it('refuses a file without a number column', async () => {
    const file = await makeExcel([['phone'], [9876543210]]);

    await expect(parseBroadcastExcel(file)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'The first row of the Excel file must have a "number" column.',
    });
  });

  it('refuses a file where no number is usable', async () => {
    const file = await makeExcel([['number'], ['abc']]);

    await expect(parseBroadcastExcel(file)).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'The Excel file has no valid numbers.',
    });
  });
});
