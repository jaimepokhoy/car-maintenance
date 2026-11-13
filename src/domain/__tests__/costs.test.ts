import { summarizeSpend } from '../costs';
import type { Expense, ServiceRecord } from '../types';

function record(performedOn: string, costCents?: number): ServiceRecord {
  return { id: performedOn, vehicleId: 'v1', itemIds: ['oil_change'], performedOn, odometerKm: 1000, costCents };
}

function expense(incurredOn: string, amountCents: number, category: Expense['category'] = 'fuel'): Expense {
  return { id: `${category}-${incurredOn}`, vehicleId: 'v1', category, incurredOn, amountCents };
}

describe('summarizeSpend', () => {
  const today = '2026-10-11';

  it('is all zeros with no records', () => {
    expect(summarizeSpend([], [], today)).toEqual({
      totalCents: 0,
      thisYearCents: 0,
      last12MonthsCents: 0,
      monthlyAverageCents: 0,
      pricedCount: 0,
      unpricedCount: 0,
      byCategory: [],
    });
  });

  it('splits services and expenses into this year, the last 12 months and all time', () => {
    const summary = summarizeSpend(
      [
        record('2026-03-01', 10000), // this year and last 12 months
        record('2025-12-01', 24000), // last 12 months only
        record('2025-10-11', 5000), // exactly 12 months ago: outside the window
        record('2023-05-05', 7000), // all time only
      ],
      [
        expense('2026-04-01', 6000),
        expense('2025-11-01', 4000),
      ],
      today,
    );
    expect(summary.totalCents).toBe(56000);
    expect(summary.thisYearCents).toBe(16000);
    expect(summary.last12MonthsCents).toBe(44000);
    expect(summary.monthlyAverageCents).toBe(3667);
    expect(summary.pricedCount).toBe(6);
  });

  it('counts services without a cost as unpriced, not free', () => {
    const summary = summarizeSpend([record('2026-01-10'), record('2026-02-10', 0)], [], today);
    expect(summary.unpricedCount).toBe(1);
    expect(summary.pricedCount).toBe(1);
    expect(summary.totalCents).toBe(0);
  });

  it('breaks spending down by category, largest first', () => {
    const summary = summarizeSpend(
      [record('2026-02-01', 15000)],
      [expense('2026-03-01', 40000, 'fuel'), expense('2026-04-01', 90000, 'insurance')],
      today,
    );
    expect(summary.byCategory).toEqual([
      { category: 'insurance', cents: 90000, count: 1 },
      { category: 'fuel', cents: 40000, count: 1 },
      { category: 'service', cents: 15000, count: 1 },
    ]);
  });
});
