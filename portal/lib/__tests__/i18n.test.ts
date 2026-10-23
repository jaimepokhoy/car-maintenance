import { describe, expect, it } from 'vitest';

import { en, format, fr, resolveLocale } from '../i18n/messages';

function leaves(value: unknown, path = ''): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      for (const [p, v] of leaves(child, path ? `${path}.${key}` : key)) out.set(p, v);
    }
  } else {
    out.set(path, value);
  }
  return out;
}

describe('messages', () => {
  it('has the same keys and placeholders in English and French', () => {
    const enLeaves = leaves(en);
    const frLeaves = leaves(fr);
    expect([...frLeaves.keys()].sort()).toEqual([...enLeaves.keys()].sort());
    for (const [key, value] of enLeaves) {
      const french = frLeaves.get(key);
      if (Array.isArray(value)) {
        expect(french, key).toHaveLength(value.length);
        continue;
      }
      const placeholders = (s: unknown) => (String(s).match(/\{\w+\}/g) ?? []).sort();
      expect(placeholders(french), key).toEqual(placeholders(value));
      expect(String(french).trim(), key).not.toBe('');
    }
  });

  it('uses Canadian spelling', () => {
    expect(JSON.stringify(en)).not.toMatch(/\bcolor\b/i);
  });
});

describe('format', () => {
  it('fills known placeholders and leaves the rest', () => {
    expect(format('Code sent to {email} {x}', { email: 'a@b.ca' })).toBe('Code sent to a@b.ca {x}');
  });
});

describe('resolveLocale', () => {
  it('prefers the cookie, then the browser language', () => {
    expect(resolveLocale('fr', 'en-CA')).toBe('fr');
    expect(resolveLocale(undefined, 'fr-CA,fr;q=0.9,en;q=0.8')).toBe('fr');
    expect(resolveLocale(undefined, 'en-CA,fr;q=0.5')).toBe('en');
    expect(resolveLocale('de', null)).toBe('en');
  });
});
