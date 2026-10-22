import {
  displayToKm,
  formatDate,
  formatDateTime,
  formatDistance,
  formatMoney,
  formatMoneyRange,
  kmToDisplay,
} from '../units';

describe('units', () => {
  it('round-trips miles', () => {
    expect(displayToKm(kmToDisplay(1000, 'mi'), 'mi')).toBeCloseTo(1000);
    expect(kmToDisplay(1000, 'km')).toBe(1000);
  });

  it('formats distance in the chosen unit', () => {
    expect(formatDistance(12_345.6, 'km', 'en-CA')).toBe('12,346 km');
    expect(formatDistance(16_093.44, 'mi', 'en-CA')).toBe('10,000 mi');
  });

  it('formats money from cents', () => {
    expect(formatMoney(8999, 'CAD', 'en-CA')).toBe('$89.99');
  });

  it('formats calendar dates without shifting the day', () => {
    expect(formatDate('2026-12-01', 'en-CA')).toBe('Dec 1, 2026');
  });
});

describe('formatMoneyRange', () => {
  it('drops the cents and joins with an en dash', () => {
    expect(formatMoneyRange(8_000, 15_000, 'CAD', 'en-CA', 'Free')).toBe('$80–$150');
    expect(formatMoneyRange(0, 4_000, 'CAD', 'en-CA', 'Free')).toBe('Free–$40');
    expect(formatMoneyRange(2_500, 2_500, 'CAD', 'en-CA', 'Free')).toBe('$25');
  });
});

describe('formatDateTime', () => {
  it('formats an instant with the date and time in each language', () => {
    expect(formatDateTime('2026-10-22T14:05:09.123Z', 'en-CA', 'UTC')).toBe('Oct 22, 2026, 2:05 p.m.');
    expect(formatDateTime('2026-10-22T14:05:09.123Z', 'fr-CA', 'UTC')).toBe('22 oct. 2026, 14 h 05');
  });
});
