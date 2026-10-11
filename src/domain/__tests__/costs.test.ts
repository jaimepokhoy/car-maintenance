import { summarizeCosts } from '../costs';
import type { ServiceRecord } from '../types';

function record(performedOn: string, costCents?: number): ServiceRecord {
  return { id: performedOn, vehicleId: 'v1', itemIds: ['oil_change'], performedOn, odometerKm: 1000, costCents };
}

describe('summarizeCosts', () => {
  const today = '2026-10-11';

  it('is all zeros with no records', () => {
    expect(summarizeCosts([], today)).toEqual({
      totalCents: 0,
      thisYearCents: 0,
      last12MonthsCents: 0,
      monthlyAverageCents: 0,
      pricedCount: 0,
      unpricedCount: 0,
    });
  });

  it('splits spending into this year, the last 12 months and all time', () => {
    const summary = summarizeCosts(
      [
        record('2026-03-01', 10000), // this year and last 12 months
        record('2025-12-01', 24000), // last 12 months only
        record('2025-10-11', 5000), // exactly 12 months ago: outside the window
        record('2023-05-05', 7000), // all time only
      ],
      today,
    );
    expect(summary.totalCents).toBe(46000);
    expect(summary.thisYearCents).toBe(10000);
    expect(summary.last12MonthsCents).toBe(34000);
    expect(summary.monthlyAverageCents).toBe(2833);
    expect(summary.pricedCount).toBe(4);
  });

  it('counts services without a cost as unpriced, not free', () => {
    const summary = summarizeCosts([record('2026-01-10'), record('2026-02-10', 0)], today);
    expect(summary.unpricedCount).toBe(1);
    expect(summary.pricedCount).toBe(1);
    expect(summary.totalCents).toBe(0);
  });
});
