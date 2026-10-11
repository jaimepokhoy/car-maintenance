import { defaultSchedule } from '@/domain/schedules';

import en from '../locales/en.json';
import fr from '../locales/fr.json';

function keys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key));
}

describe('locales', () => {
  it('French has exactly the same keys as English', () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });

  it('has no empty strings', () => {
    for (const locale of [en, fr]) {
      for (const key of keys(locale)) {
        const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)[part], locale);
        expect(value).not.toBe('');
      }
    }
  });
});

describe('maintenance item labels', () => {
  it('exist for every item in every default schedule', () => {
    for (const powertrain of ['gas', 'hybrid', 'ev'] as const) {
      for (const { itemId } of defaultSchedule(powertrain)) {
        expect(en.items[itemId]).toBeTruthy();
        expect(fr.items[itemId]).toBeTruthy();
      }
    }
  });
});

describe('guidance', () => {
  it('has an explanation for every maintenance item in both languages', () => {
    for (const itemId of Object.keys(en.items) as (keyof typeof en.items)[]) {
      for (const locale of [en, fr]) {
        expect(locale.guidance.items[itemId].what).toBeTruthy();
        expect(locale.guidance.items[itemId].why).toBeTruthy();
      }
    }
  });
});
