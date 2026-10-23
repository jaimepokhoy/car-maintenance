import { describe, expect, it } from 'vitest';

import { dueText } from '../due-text';
import { en, fr } from '../i18n/messages';

describe('dueText', () => {
  it('shows whichever limits the item has', () => {
    const both = { itemId: 'oil_change', state: 'due_soon', dueOn: '2026-11-01', dueAtKm: 56_000 } as const;
    expect(dueText(both, 'en', en.due)).toBe('Nov 1, 2026 or at 56,000 km');
    expect(dueText({ itemId: 'brake_fluid', state: 'ok', dueOn: '2027-03-01' }, 'en', en.due)).toBe('Mar 1, 2027');
    expect(dueText({ itemId: 'spark_plugs', state: 'ok', dueAtKm: 150_000 }, 'en', en.due)).toBe('at 150,000 km');
    expect(dueText({ itemId: 'coolant', state: 'unknown' }, 'en', en.due)).toBe('');
  });

  it('formats for French Canada', () => {
    const text = dueText({ itemId: 'spark_plugs', state: 'ok', dueAtKm: 150_000 }, 'fr', fr.due);
    expect(text.replace(/\s/g, ' ')).toBe('à 150 000 km');
  });
});
