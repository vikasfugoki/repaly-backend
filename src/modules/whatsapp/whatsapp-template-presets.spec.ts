import { describe, expect, it } from '@jest/globals';
import {
  buildPresetTemplate,
  listTemplatePresets,
} from './whatsapp-template-presets';

const SALE_FIELDS = {
  sale_name: 'Diwali',
  business_name: 'Riya Jewels',
  discount: '30',
  last_date: '15 Nov',
  website_link: 'riyajewels.in',
};

describe('listTemplatePresets', () => {
  it('lists the six presets with the blanks each one needs', () => {
    const presets = listTemplatePresets();

    expect(presets.map((p) => p.id)).toEqual([
      'welcome',
      'new_collection',
      'festive_sale',
      'thank_you',
      'order_confirmed',
      'order_shipped',
    ]);
    expect(
      presets.find((p) => p.id === 'festive_sale')?.fields.map((f) => f.key),
    ).toEqual([
      'sale_name',
      'business_name',
      'discount',
      'last_date',
      'website_link',
    ]);
    expect(
      presets.find((p) => p.id === 'order_shipped')?.fields.map((f) => f.key),
    ).toEqual(['business_name']);
  });

  it('only uses the customer name variable, so every preset can be broadcast', () => {
    for (const preset of listTemplatePresets()) {
      const fields = Object.fromEntries(
        preset.fields.map((f) => [f.key, f.placeholder]),
      );
      const template = buildPresetTemplate(preset.id, fields);

      // The Excel broadcast supports one body variable, filled with the customer name.
      expect(template.components[0].text.match(/\{\{\s*\w+\s*\}\}/g)).toEqual([
        '{{1}}',
      ]);
      expect(template.components[0].text).not.toMatch(/\[\w+\]/);
    }
  });
});

describe('buildPresetTemplate', () => {
  it('fills the blanks and returns the body for Meta', () => {
    const template = buildPresetTemplate('festive_sale', SALE_FIELDS);

    expect(template).toEqual({
      name: expect.stringMatching(/^festive_sale_[a-f0-9]{6}$/),
      language: 'en',
      category: 'MARKETING',
      components: [
        {
          type: 'BODY',
          text:
            'Hi {{1}}, our Diwali sale is live at Riya Jewels! Get flat 30% off on your ' +
            'favourite styles. Offer valid till 15 Nov. Shop now: riyajewels.in',
          example: { body_text: [['Rahul']] },
        },
      ],
    });
  });

  it('gives each submission a new name', () => {
    const first = buildPresetTemplate('festive_sale', SALE_FIELDS);
    const second = buildPresetTemplate('festive_sale', SALE_FIELDS);

    expect(first.name).not.toBe(second.name);
  });

  it('tidies spaces and new lines, and ignores fields the preset does not use', () => {
    const template = buildPresetTemplate('order_shipped', {
      business_name: '  Riya \n  Jewels ',
      discount: 'ignored',
    });

    expect(template.category).toBe('UTILITY');
    expect(template.components[0].text).toBe(
      'Hi {{1}}, your order from Riya Jewels has been shipped and will reach you soon. ' +
        'Thank you for shopping with us!',
    );
  });

  it('accepts the discount as a number', () => {
    const template = buildPresetTemplate('festive_sale', {
      ...SALE_FIELDS,
      discount: 30,
    });

    expect(template.components[0].text).toContain('flat 30% off');
  });

  it.each([
    'https://riyajewels.in/shop',
    'http://www.riyajewels.in',
    'riya-jewels.co.in/new',
  ])('accepts the website link %s', (link) => {
    expect(() =>
      buildPresetTemplate('welcome', {
        business_name: 'Riya Jewels',
        website_link: link,
      }),
    ).not.toThrow();
  });

  it.each([
    [
      { ...SALE_FIELDS, discount: '0' },
      'Discount (%) must be a whole number from 1 to 99.',
    ],
    [
      { ...SALE_FIELDS, discount: '100' },
      'Discount (%) must be at most 2 characters.',
    ],
    [
      { ...SALE_FIELDS, discount: '12.5' },
      'Discount (%) must be at most 2 characters.',
    ],
    [
      { ...SALE_FIELDS, discount: 'ab' },
      'Discount (%) must be a whole number from 1 to 99.',
    ],
    [{ ...SALE_FIELDS, sale_name: '' }, 'Sale name is required.'],
    [{ ...SALE_FIELDS, sale_name: '   ' }, 'Sale name is required.'],
    [{ ...SALE_FIELDS, sale_name: { x: 1 } }, 'Sale name is required.'],
    [
      { ...SALE_FIELDS, sale_name: 'x'.repeat(41) },
      'Sale name must be at most 40 characters.',
    ],
    [
      { ...SALE_FIELDS, sale_name: 'Diwali {{2}}' },
      'Sale name cannot contain { or }.',
    ],
    [
      { ...SALE_FIELDS, website_link: 'not a link' },
      'Website link must be a valid website link, like riyajewels.in.',
    ],
    [
      { ...SALE_FIELDS, website_link: 'localhost' },
      'Website link must be a valid website link, like riyajewels.in.',
    ],
    [
      { ...SALE_FIELDS, website_link: 'javascript:alert(1)' },
      'Website link must be a valid website link, like riyajewels.in.',
    ],
  ])('refuses bad fields: %j', (fields, message) => {
    expect(() => buildPresetTemplate('festive_sale', fields)).toThrow(message);
  });

  it('refuses a missing field list', () => {
    expect(() => buildPresetTemplate('welcome', undefined)).toThrow(
      'Business name is required.',
    );
  });

  it('refuses an unknown preset', () => {
    expect(() => buildPresetTemplate('cod_confirmation', {})).toThrow(
      'Unknown template preset.',
    );
  });

  it('marks its errors as bad requests', () => {
    let error: unknown;
    try {
      buildPresetTemplate('nope', {});
    } catch (caught) {
      error = caught;
    }
    expect(error).toMatchObject({ code: 'BAD_REQUEST' });
  });
});
