import { addMonths, daysBetween } from '../dates';

describe('addMonths', () => {
  it('adds months within a year', () => {
    expect(addMonths('2026-01-15', 6)).toBe('2026-07-15');
  });

  it('rolls over the year', () => {
    expect(addMonths('2026-10-11', 6)).toBe('2027-04-11');
  });

  it('clamps to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
  });

  it('rejects malformed dates', () => {
    expect(() => addMonths('2026/01/01', 1)).toThrow('Invalid ISO date');
  });
});

describe('daysBetween', () => {
  it('counts whole days in either direction', () => {
    expect(daysBetween('2026-10-01', '2026-10-11')).toBe(10);
    expect(daysBetween('2026-10-11', '2026-10-01')).toBe(-10);
  });

  it('is unaffected by daylight saving changes', () => {
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1);
    expect(daysBetween('2026-03-08', '2026-03-09')).toBe(1);
  });
});
