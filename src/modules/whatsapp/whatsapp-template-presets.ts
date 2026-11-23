import { randomUUID } from 'crypto';

/**
 * Ready-made WhatsApp templates for clothing and jewellery businesses. The user
 * picks one and fills only its [blanks]; the text itself cannot be changed.
 * {{1}} is the customer's name, filled per customer when the template is sent,
 * so every preset works with the Excel broadcast (which supports one variable).
 */

const PRESET_LANGUAGE = 'en';
const SAMPLE_CUSTOMER_NAME = 'Rahul'; // Meta needs an example value for {{1}}
const BLANK_PATTERN = /\[(\w+)\]/g;

type FieldType = 'text' | 'number' | 'url';

interface PresetField {
  label: string;
  placeholder: string;
  maxLength: number;
  type: FieldType;
}

interface TemplatePreset {
  id: string;
  title: string;
  category: 'MARKETING' | 'UTILITY';
  text: string;
}

const FIELDS: Record<string, PresetField> = {
  business_name: {
    label: 'Business name',
    placeholder: 'Riya Jewels',
    maxLength: 60,
    type: 'text',
  },
  website_link: {
    label: 'Website link',
    placeholder: 'riyajewels.in',
    maxLength: 200,
    type: 'url',
  },
  collection_name: {
    label: 'Collection name',
    placeholder: 'Bridal',
    maxLength: 40,
    type: 'text',
  },
  sale_name: {
    label: 'Sale name',
    placeholder: 'Diwali',
    maxLength: 40,
    type: 'text',
  },
  discount: {
    label: 'Discount (%)',
    placeholder: '30',
    maxLength: 2,
    type: 'number',
  },
  last_date: {
    label: 'Offer valid till',
    placeholder: '15 Nov',
    maxLength: 30,
    type: 'text',
  },
};

const PRESETS: TemplatePreset[] = [
  {
    id: 'welcome',
    title: 'Welcome',
    category: 'MARKETING',
    text:
      'Hi {{1}}, welcome to [business_name]! We are so happy to have you. ' +
      'Explore our latest collection here: [website_link]',
  },
  {
    id: 'new_collection',
    title: 'New Collection',
    category: 'MARKETING',
    text:
      'Hi {{1}}, our new [collection_name] collection is now live at [business_name]! ' +
      'Explore the latest designs before they sell out. Shop now: [website_link]',
  },
  {
    id: 'festive_sale',
    title: 'Festive Sale',
    category: 'MARKETING',
    text:
      'Hi {{1}}, our [sale_name] sale is live at [business_name]! ' +
      'Get flat [discount]% off on your favourite styles. Offer valid till [last_date]. ' +
      'Shop now: [website_link]',
  },
  {
    id: 'thank_you',
    title: 'Thank You',
    category: 'MARKETING',
    text:
      'Hi {{1}}, thank you for choosing [business_name]! We hope you loved your purchase. ' +
      'Check out our latest arrivals: [website_link]',
  },
  {
    id: 'order_confirmed',
    title: 'Order Confirmed',
    category: 'UTILITY',
    text:
      'Hi {{1}}, thank you for shopping with [business_name]! Your order has been confirmed. ' +
      'We will update you once it is shipped.',
  },
  {
    id: 'order_shipped',
    title: 'Order Shipped',
    category: 'UTILITY',
    text:
      'Hi {{1}}, your order from [business_name] has been shipped and will reach you soon. ' +
      'Thank you for shopping with us!',
  },
];

function badRequest(message: string) {
  return Object.assign(new Error(message), { code: 'BAD_REQUEST' });
}

/** The blanks in a preset's text, in the order they appear. */
function blanksOf(preset: TemplatePreset): string[] {
  return [
    ...new Set([...preset.text.matchAll(BLANK_PATTERN)].map((m) => m[1])),
  ];
}

/** Accepts "riyajewels.in" or "https://riyajewels.in/shop", nothing without a real domain. */
function isWebsiteLink(value: string): boolean {
  if (/\s/.test(value)) return false;
  try {
    const url = new URL(
      /^https?:\/\//i.test(value) ? value : `https://${value}`,
    );
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(url.hostname);
  } catch {
    return false;
  }
}

/** Checks one filled blank and returns it cleaned, or throws a message for the user. */
function readField(key: string, raw: unknown): string {
  const field = FIELDS[key];
  const value =
    typeof raw === 'string' || typeof raw === 'number'
      ? String(raw).replace(/\s+/g, ' ').trim()
      : '';

  if (!value) {
    throw badRequest(`${field.label} is required.`);
  }
  if (value.length > field.maxLength) {
    throw badRequest(
      `${field.label} must be at most ${field.maxLength} characters.`,
    );
  }
  // Braces would turn the user's text into extra template variables.
  if (/[{}]/.test(value)) {
    throw badRequest(`${field.label} cannot contain { or }.`);
  }
  if (
    field.type === 'number' &&
    !(/^\d+$/.test(value) && +value >= 1 && +value <= 99)
  ) {
    throw badRequest(`${field.label} must be a whole number from 1 to 99.`);
  }
  if (field.type === 'url' && !isWebsiteLink(value)) {
    throw badRequest(
      `${field.label} must be a valid website link, like riyajewels.in.`,
    );
  }
  return value;
}

/** What the frontend needs to show the preset cards and their forms. */
export function listTemplatePresets() {
  return PRESETS.map((preset) => ({
    id: preset.id,
    title: preset.title,
    category: preset.category,
    language: PRESET_LANGUAGE,
    text: preset.text,
    fields: blanksOf(preset).map((key) => ({ key, ...FIELDS[key] })),
  }));
}

/**
 * Fills a preset's blanks and returns the body for Meta's create-template call.
 * The name gets a random suffix, so the same preset can be submitted again
 * (e.g. a Holi sale after a Diwali sale) without clashing on Meta's side.
 */
export function buildPresetTemplate(presetId: unknown, fields: unknown) {
  const preset = PRESETS.find((p) => p.id === presetId);
  if (!preset) {
    throw badRequest('Unknown template preset.');
  }

  const input = (fields && typeof fields === 'object' ? fields : {}) as Record<
    string,
    unknown
  >;
  const values: Record<string, string> = {};
  for (const key of blanksOf(preset)) {
    values[key] = readField(key, input[key]);
  }

  const suffix = randomUUID().replace(/-/g, '').slice(0, 6);
  return {
    name: `${preset.id}_${suffix}`,
    language: PRESET_LANGUAGE,
    category: preset.category,
    components: [
      {
        type: 'BODY',
        text: preset.text.replace(
          BLANK_PATTERN,
          (_, key: string) => values[key],
        ),
        example: { body_text: [[SAMPLE_CUSTOMER_NAME]] },
      },
    ],
  };
}
