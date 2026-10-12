import { displayToKm, formatDate, formatDistance, formatMoney, kmToDisplay } from '../units';

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
