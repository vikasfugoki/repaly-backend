import { describe, expect, it } from '@jest/globals';
import {
  listAiReplyFields,
  parseAiReply,
  toPublicAiReply,
} from './whatsapp-ai-reply';

const NOW = '2026-11-12T10:00:00.000Z';

describe('listAiReplyFields', () => {
  it('lists the form fields in order', () => {
    expect(listAiReplyFields().map((f) => f.key)).toEqual([
      'business_name',
      'about',
      'products',
      'timings',
      'address',
      'website',
      'policies',
      'extra_info',
    ]);
  });
});

describe('parseAiReply', () => {
  it('trims values and leaves empty ones out', () => {
    expect(
      parseAiReply(
        { enabled: true, business_name: '  My Shop ', about: '   ', timings: null },
        NOW,
      ),
    ).toEqual({ enabled: true, updated_time: NOW, business_name: 'My Shop' });
  });

  it('keeps new lines inside a value', () => {
    expect(
      parseAiReply({ enabled: false, products: 'Item A\nItem B' }, NOW).products,
    ).toBe('Item A\nItem B');
  });

  it('ignores updated_time sent back from the GET response', () => {
    expect(
      parseAiReply({ enabled: false, updated_time: 'old' }, NOW),
    ).toEqual({ enabled: false, updated_time: NOW });
  });

  it('rejects fields it does not know', () => {
    expect(() => parseAiReply({ enabled: false, product: 'x' }, NOW)).toThrow(
      'Unknown field: product.',
    );
  });

  it('needs enabled to be true or false', () => {
    expect(() => parseAiReply({ business_name: 'My Shop' }, NOW)).toThrow(
      'enabled must be true or false.',
    );
    expect(() => parseAiReply({ enabled: 'true' }, NOW)).toThrow(
      'enabled must be true or false.',
    );
  });

  it('rejects a value that is not text', () => {
    expect(() => parseAiReply({ enabled: false, about: 5 }, NOW)).toThrow(
      'About your business must be text.',
    );
  });

  it('rejects a value over the field limit', () => {
    expect(() =>
      parseAiReply({ enabled: false, business_name: 'a'.repeat(101) }, NOW),
    ).toThrow('Business name must be at most 100 characters.');
    expect(
      parseAiReply({ enabled: false, about: 'a'.repeat(1000) }, NOW).about,
    ).toHaveLength(1000);
  });

  it('cannot be turned on with no details, but can be saved off', () => {
    expect(() => parseAiReply({ enabled: true, about: '  ' }, NOW)).toThrow(
      'Fill in at least one detail before turning on AI reply.',
    );
    expect(parseAiReply({ enabled: false }, NOW)).toEqual({
      enabled: false,
      updated_time: NOW,
    });
  });

  it('rejects a body that is not an object', () => {
    for (const body of [undefined, null, 'x', []]) {
      expect(() => parseAiReply(body, NOW)).toThrow(
        'Request body must be a JSON object.',
      );
    }
  });
});

describe('toPublicAiReply', () => {
  it('gives an empty, switched-off form when nothing is saved', () => {
    expect(toPublicAiReply(undefined)).toEqual({
      enabled: false,
      business_name: '',
      about: '',
      products: '',
      timings: '',
      address: '',
      website: '',
      policies: '',
      extra_info: '',
      updated_time: null,
    });
  });

  it('fills saved values and drops keys it does not know', () => {
    const result = toPublicAiReply({
      enabled: true,
      business_name: 'My Shop',
      updated_time: NOW,
      something_else: 'x',
    });
    expect(result.enabled).toBe(true);
    expect(result.business_name).toBe('My Shop');
    expect(result.about).toBe('');
    expect(result.updated_time).toBe(NOW);
    expect(result).not.toHaveProperty('something_else');
  });
});
