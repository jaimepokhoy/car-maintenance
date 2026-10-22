import { describe, expect, it } from 'vitest';

import { hoursByDay, isTime, parseHours } from '../hours';

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) data.set(key, value);
  return data;
}

describe('parseHours', () => {
  it('keeps only ticked days, Sunday as 0', () => {
    const result = parseHours(
      form({
        'hours-1-open': 'on',
        'hours-1-opens': '08:00',
        'hours-1-closes': '17:30',
        'hours-0-opens': '10:00',
        'hours-0-closes': '14:00',
      }),
    );
    expect(result).toEqual({ ok: true, hours: [{ day: 1, opens: '08:00', closes: '17:30' }] });
  });

  it('gives null when no day is open', () => {
    expect(parseHours(form({}))).toEqual({ ok: true, hours: null });
  });

  it('rejects missing times and closing before opening', () => {
    const result = parseHours(
      form({
        'hours-2-open': 'on',
        'hours-2-opens': '',
        'hours-2-closes': '17:00',
        'hours-3-open': 'on',
        'hours-3-opens': '18:00',
        'hours-3-closes': '09:00',
      }),
    );
    expect(result).toEqual({ ok: false, invalidDays: [2, 3] });
  });
});

describe('hoursByDay', () => {
  it('takes the first valid opening per day and ignores junk', () => {
    const byDay = hoursByDay([
      { day: 6, opens: '09:00', closes: '12:00' },
      { day: 6, opens: '13:00', closes: '16:00' },
      { day: 9, opens: '09:00', closes: '12:00' },
      'nope',
    ]);
    expect([...byDay.keys()]).toEqual([6]);
    expect(byDay.get(6)?.closes).toBe('12:00');
  });

  it('handles null', () => {
    expect(hoursByDay(null).size).toBe(0);
  });
});

describe('isTime', () => {
  it('accepts 24-hour HH:MM', () => {
    expect(isTime('00:00')).toBe(true);
    expect(isTime('23:59')).toBe(true);
    expect(isTime('24:00')).toBe(false);
    expect(isTime('9:00')).toBe(false);
  });
});
