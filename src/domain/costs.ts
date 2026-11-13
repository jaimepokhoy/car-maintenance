import { addMonths } from './dates';
import type { Expense, ExpenseCategory, IsoDate, ServiceRecord } from './types';

/** Spending categories as the owner sees them: logged services plus every expense. */
export type SpendCategory = ExpenseCategory | 'service';

export interface CategorySpend {
  category: SpendCategory;
  cents: number;
  count: number;
}

export interface SpendSummary {
  /** Everything ever logged with an amount, in cents. */
  totalCents: number;
  /** Spent since January 1 of the current year. */
  thisYearCents: number;
  /** Spent in the 12 months up to and including today. */
  last12MonthsCents: number;
  /** Average per month over the last 12 months, rounded to the cent. */
  monthlyAverageCents: number;
  /** Services and expenses that have an amount recorded. */
  pricedCount: number;
  /** Services logged without a cost, so owners know the totals are partial. */
  unpricedCount: number;
  /** Largest category first; categories with no spend are omitted. */
  byCategory: CategorySpend[];
}

/** Category order for legends and breakdowns: the biggest recurring costs first. */
export const SPEND_CATEGORIES: readonly SpendCategory[] = [
  'fuel',
  'service',
  'insurance',
  'registration',
  'repairs',
  'tires',
  'parking',
  'tolls',
  'wash',
  'other',
];

interface DatedAmount {
  date: IsoDate;
  cents: number;
  category: SpendCategory;
}

/**
 * Totals what an owner has spent on a vehicle, across logged services and
 * every other expense. Services without a cost count as unpriced rather than
 * free, so the screen can say the total is partial.
 */
export function summarizeSpend(
  records: ServiceRecord[],
  expenses: Expense[],
  today: IsoDate,
): SpendSummary {
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const twelveMonthsAgo = addMonths(today, -12);
  const summary: SpendSummary = {
    totalCents: 0,
    thisYearCents: 0,
    last12MonthsCents: 0,
    monthlyAverageCents: 0,
    pricedCount: 0,
    unpricedCount: 0,
    byCategory: [],
  };
  const amounts: DatedAmount[] = [];

  for (const record of records) {
    if (record.costCents === undefined) {
      summary.unpricedCount += 1;
      continue;
    }
    amounts.push({ date: record.performedOn, cents: record.costCents, category: 'service' });
  }
  for (const expense of expenses) {
    amounts.push({ date: expense.incurredOn, cents: expense.amountCents, category: expense.category });
  }

  const byCategory = new Map<SpendCategory, CategorySpend>();
  for (const amount of amounts) {
    summary.pricedCount += 1;
    summary.totalCents += amount.cents;
    if (amount.date >= yearStart && amount.date <= today) summary.thisYearCents += amount.cents;
    if (amount.date > twelveMonthsAgo && amount.date <= today) summary.last12MonthsCents += amount.cents;

    const entry = byCategory.get(amount.category) ?? { category: amount.category, cents: 0, count: 0 };
    entry.cents += amount.cents;
    entry.count += 1;
    byCategory.set(amount.category, entry);
  }

  summary.monthlyAverageCents = Math.round(summary.last12MonthsCents / 12);
  summary.byCategory = [...byCategory.values()].sort(
    (a, b) => b.cents - a.cents || SPEND_CATEGORIES.indexOf(a.category) - SPEND_CATEGORIES.indexOf(b.category),
  );
  return summary;
}
