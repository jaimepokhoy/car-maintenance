import { summarizeSpend, type SpendSummary } from './costs';
import type { DueStatus } from './due-status';
import type { Expense, IsoDate, MaintenanceItemId, ServiceRecord, Vehicle } from './types';

export type CareGrade = 'excellent' | 'good' | 'fair' | 'at_risk';

/** Grade bands the report card shows, once there is enough history to score. */
export const CARE_GRADES: readonly { grade: CareGrade; minScore: number }[] = [
  { grade: 'excellent', minScore: 85 },
  { grade: 'good', minScore: 70 },
  { grade: 'fair', minScore: 50 },
  { grade: 'at_risk', minScore: 0 },
];

export interface CareBreakdown {
  ok: number;
  dueSoon: number;
  overdue: number;
  unknown: number;
  /** Items with a recorded service; the base for the adherence part of the score. */
  tracked: number;
  /** Items in the vehicle's schedule. */
  total: number;
}

export interface VehicleEvaluation {
  /** 0–100, or null until at least one schedule item has been logged. */
  score: number | null;
  grade?: CareGrade;
  breakdown: CareBreakdown;
  /** Services and expenses combined. */
  spend: SpendSummary;
  /** Kilometres covered by the logged history, from the lowest recorded reading. */
  documentedKm?: number;
  /** Total spend per 1,000 documented km, rounded to the cent. */
  costPer1000KmCents?: number;
  servicesLogged: number;
  expensesLogged: number;
  /** The most urgent item that has any history, for the "start here" line. */
  nextItemId?: MaintenanceItemId;
  /** True once something is logged, which is when a score becomes meaningful. */
  hasHistory: boolean;
}

/** The band a score falls in; the last band starts at 0, so this never misses. */
function gradeFor(score: number): CareGrade {
  return (CARE_GRADES.find((band) => score >= band.minScore) ?? CARE_GRADES[CARE_GRADES.length - 1]).grade;
}

/**
 * A care score for a vehicle, built only from what the owner has logged:
 * 50 points for keeping tracked items up to date (an item due soon counts
 * half) and 50 for how much of the schedule has any history at all. Items
 * never logged are not failures; they hold the score back until they are.
 *
 * This is a maintenance-hygiene score, not a market valuation. Spend and
 * distance facts sit beside it so the owner can see what the car has cost.
 */
export function evaluateVehicle(
  vehicle: Pick<Vehicle, 'odometerKm'>,
  statuses: DueStatus[],
  records: ServiceRecord[],
  expenses: Expense[],
  today: IsoDate,
): VehicleEvaluation {
  const breakdown: CareBreakdown = {
    ok: 0,
    dueSoon: 0,
    overdue: 0,
    unknown: 0,
    tracked: 0,
    total: statuses.length,
  };
  for (const status of statuses) {
    if (status.state === 'ok') breakdown.ok += 1;
    else if (status.state === 'due_soon') breakdown.dueSoon += 1;
    else if (status.state === 'overdue') breakdown.overdue += 1;
    else breakdown.unknown += 1;
  }
  breakdown.tracked = breakdown.ok + breakdown.dueSoon + breakdown.overdue;

  const spend = summarizeSpend(records, expenses, today);

  const lowestReading = [...records, ...expenses].reduce<number | undefined>(
    (lowest, entry) =>
      entry.odometerKm === undefined ? lowest : lowest === undefined ? entry.odometerKm : Math.min(lowest, entry.odometerKm),
    undefined,
  );
  const documentedKm = lowestReading === undefined ? undefined : Math.max(0, vehicle.odometerKm - lowestReading);
  const costPer1000KmCents =
    documentedKm && documentedKm >= 100
      ? Math.round((spend.totalCents / documentedKm) * 1_000)
      : undefined;

  const nextItem = statuses.find((status) => status.state !== 'unknown');

  let score: number | null = null;
  if (breakdown.tracked > 0) {
    const adherence = (breakdown.ok + 0.5 * breakdown.dueSoon) / breakdown.tracked;
    const coverage = breakdown.total === 0 ? 0 : breakdown.tracked / breakdown.total;
    score = Math.round(50 * adherence + 50 * coverage);
  }

  return {
    score,
    grade: score === null ? undefined : gradeFor(score),
    breakdown,
    spend,
    documentedKm: documentedKm || undefined,
    costPer1000KmCents,
    servicesLogged: records.length,
    expensesLogged: expenses.length,
    nextItemId: nextItem?.itemId,
    hasHistory: breakdown.tracked > 0,
  };
}
