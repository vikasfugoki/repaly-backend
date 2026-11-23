/**
 * The seller's AI auto-reply settings for one WhatsApp number. They are saved
 * as the `ai_reply` map on that number's `whatsapp_business_account_repository`
 * row. When a customer messages the number, the `whatsapp_processor` Lambda
 * reads this map and puts every non-empty text field into the GPT prompt, so
 * only the fields listed here may ever be saved in it.
 */

export interface AiReplyField {
  key: string;
  label: string;
  placeholder: string;
  maxLength: number;
}

export interface StoredAiReply {
  enabled: boolean;
  updated_time: string;
  [field: string]: string | boolean;
}

const FIELDS: AiReplyField[] = [
  { key: 'business_name', label: 'Business name', placeholder: 'Your business name', maxLength: 100 },
  { key: 'about', label: 'About your business', placeholder: 'What your business does', maxLength: 100000 },
  { key: 'products', label: 'Products and prices', placeholder: 'Products you sell and their prices', maxLength: 100000 },
  { key: 'timings', label: 'Business hours', placeholder: 'Days and hours you are open', maxLength: 100000 },
  { key: 'address', label: 'Address', placeholder: 'Shop or pickup address', maxLength: 100000 },
  { key: 'website', label: 'Website or Instagram link', placeholder: 'Link customers can visit', maxLength: 200 },
  { key: 'policies', label: 'Delivery, return and payment policy', placeholder: 'Delivery, return and payment rules', maxLength: 100000 },
  { key: 'extra_info', label: 'Anything else', placeholder: 'Other things customers often ask', maxLength: 100000 },
];

// DynamoDB rejects an item over 400 KB, and the account row also holds the
// access token and connect details. Each field may be up to its own limit,
// but all of them together must fit in this many UTF-8 bytes.
export const MAX_TOTAL_BYTES = 300_000;

// The GET response includes this, so a form that sends the object back as it
// is must not be rejected for it. The backend always sets it itself.
const READ_ONLY_KEYS = new Set(['updated_time']);

function badRequest(message: string) {
  return Object.assign(new Error(message), { code: 'BAD_REQUEST' });
}

/** The inputs the frontend shows in the AI reply form, in order. */
export function listAiReplyFields(): AiReplyField[] {
  return FIELDS.map((field) => ({ ...field }));
}

/**
 * Checks the AI reply form and returns what to save. Values are trimmed and
 * empty ones are left out. Throws a message for the user when the body is wrong.
 */
export function parseAiReply(
  body: unknown,
  now: string = new Date().toISOString(),
): StoredAiReply {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Request body must be a JSON object.');
  }
  const input = body as Record<string, unknown>;

  const unknownKey = Object.keys(input).find(
    (key) =>
      key !== 'enabled' &&
      !READ_ONLY_KEYS.has(key) &&
      !FIELDS.some((field) => field.key === key),
  );
  if (unknownKey) {
    throw badRequest(`Unknown field: ${unknownKey}.`);
  }

  if (typeof input.enabled !== 'boolean') {
    throw badRequest('enabled must be true or false.');
  }

  const saved: StoredAiReply = { enabled: input.enabled, updated_time: now };
  for (const field of FIELDS) {
    const raw = input[field.key];
    if (raw === undefined || raw === null) continue;
    if (typeof raw !== 'string') {
      throw badRequest(`${field.label} must be text.`);
    }
    const value = raw.trim();
    if (value.length > field.maxLength) {
      throw badRequest(
        `${field.label} must be at most ${field.maxLength} characters.`,
      );
    }
    if (value) saved[field.key] = value;
  }

  const totalBytes = FIELDS.reduce((sum, field) => {
    const value = saved[field.key];
    return typeof value === 'string'
      ? sum + Buffer.byteLength(value, 'utf8')
      : sum;
  }, 0);
  if (totalBytes > MAX_TOTAL_BYTES) {
    throw badRequest(
      'All details together are too long to save. Please shorten some of them.',
    );
  }

  // The Lambda sends no AI reply without any business info, so "on" would be a lie.
  if (saved.enabled && !FIELDS.some((field) => saved[field.key])) {
    throw badRequest('Fill in at least one detail before turning on AI reply.');
  }

  return saved;
}

/**
 * The saved settings in the shape the form needs: every field present, empty
 * ones as "". `updated_time` is null when the seller has never saved.
 */
export function toPublicAiReply(stored: unknown) {
  const saved =
    stored && typeof stored === 'object'
      ? (stored as Record<string, unknown>)
      : {};

  const result: Record<string, string | boolean | null> = {
    enabled: saved.enabled === true,
  };
  for (const field of FIELDS) {
    const value = saved[field.key];
    result[field.key] = typeof value === 'string' ? value : '';
  }
  result.updated_time =
    typeof saved.updated_time === 'string' ? saved.updated_time : null;
  return result;
}
