import { addMonths } from './dates';
import type { IsoDate, ServiceRecord } from './types';

export interface CostSummary {
  /** Everything ever logged with a cost, in cents. */
  totalCents: number;
  /** Spent since January 1 of the current year. */
  thisYearCents: number;
  /** Spent in the 12 months up to and including today. */
  last12MonthsCents: number;
  /** Average per month over the last 12 months, rounded to the cent. */
  monthlyAverageCents: number;
  /** Services that have a cost recorded. */
  pricedCount: number;
  /** Services logged without a cost, so owners know the totals are partial. */
  unpricedCount: number;
}

/**
 * Totals what an owner has spent on a vehicle. Services without a cost count
 * as unpriced rather than free, so the screen can say the total is partial.
 */
export function summarizeCosts(records: ServiceRecord[], today: IsoDate): CostSummary {
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const twelveMonthsAgo = addMonths(today, -12);
  const summary: CostSummary = {
    totalCents: 0,
    thisYearCents: 0,
    last12MonthsCents: 0,
    monthlyAverageCents: 0,
    pricedCount: 0,
    unpricedCount: 0,
  };

  for (const record of records) {
    if (record.costCents === undefined) {
      summary.unpricedCount += 1;
      continue;
    }
    summary.pricedCount += 1;
    summary.totalCents += record.costCents;
    if (record.performedOn >= yearStart && record.performedOn <= today) {
      summary.thisYearCents += record.costCents;
    }
    if (record.performedOn > twelveMonthsAgo && record.performedOn <= today) {
      summary.last12MonthsCents += record.costCents;
    }
  }
  summary.monthlyAverageCents = Math.round(summary.last12MonthsCents / 12);
  return summary;
}
