import { addMonths, daysBetween } from './dates';
import type { IsoDate, MaintenanceInterval, MaintenanceItemId, ServiceRecord, Vehicle } from './types';

/** An item becomes "due soon" when it is this close on either limit. */
export const DUE_SOON_DAYS = 30;
export const DUE_SOON_KM = 1_000;

export type DueState = 'overdue' | 'due_soon' | 'ok' | 'unknown';

export interface DueStatus {
  itemId: MaintenanceItemId;
  state: DueState;
  lastService?: ServiceRecord;
  dueOn?: IsoDate;
  dueAtKm?: number;
  /** Negative when overdue. */
  daysRemaining?: number;
  /** Negative when overdue. */
  kmRemaining?: number;
}

const SEVERITY: Record<DueState, number> = { overdue: 0, due_soon: 1, unknown: 2, ok: 3 };

export function lastServiceFor(
  itemId: MaintenanceItemId,
  records: ServiceRecord[],
): ServiceRecord | undefined {
  let latest: ServiceRecord | undefined;
  for (const record of records) {
    if (!record.itemIds.includes(itemId)) continue;
    if (
      !latest ||
      record.performedOn > latest.performedOn ||
      (record.performedOn === latest.performedOn && record.odometerKm > latest.odometerKm)
    ) {
      latest = record;
    }
  }
  return latest;
}

/**
 * Works out whether one maintenance item is due, using whichever of the date
 * or distance limit comes first. Items with no recorded service are
 * `unknown`: we can't guess, so the UI asks the owner when it was last done.
 */
export function computeDueStatus(
  interval: MaintenanceInterval,
  vehicle: Pick<Vehicle, 'odometerKm'>,
  records: ServiceRecord[],
  today: IsoDate,
): DueStatus {
  const lastService = lastServiceFor(interval.itemId, records);
  if (!lastService) return { itemId: interval.itemId, state: 'unknown' };

  const status: DueStatus = { itemId: interval.itemId, state: 'ok', lastService };

  if (interval.everyMonths !== undefined) {
    status.dueOn = addMonths(lastService.performedOn, interval.everyMonths);
    status.daysRemaining = daysBetween(today, status.dueOn);
  }
  if (interval.everyKm !== undefined) {
    status.dueAtKm = lastService.odometerKm + interval.everyKm;
    status.kmRemaining = status.dueAtKm - vehicle.odometerKm;
  }

  const { daysRemaining, kmRemaining } = status;
  if ((daysRemaining !== undefined && daysRemaining < 0) || (kmRemaining !== undefined && kmRemaining < 0)) {
    status.state = 'overdue';
  } else if (
    (daysRemaining !== undefined && daysRemaining <= DUE_SOON_DAYS) ||
    (kmRemaining !== undefined && kmRemaining <= DUE_SOON_KM)
  ) {
    status.state = 'due_soon';
  }
  return status;
}

/** Due status for every item in a schedule, most urgent first. */
export function computeVehicleDueStatuses(
  schedule: MaintenanceInterval[],
  vehicle: Pick<Vehicle, 'id' | 'odometerKm'>,
  records: ServiceRecord[],
  today: IsoDate,
): DueStatus[] {
  const own = records.filter((record) => record.vehicleId === vehicle.id);
  return schedule
    .map((interval) => computeDueStatus(interval, vehicle, own, today))
    .sort((a, b) => SEVERITY[a.state] - SEVERITY[b.state] || urgency(a) - urgency(b));
}

/** Rough sort key within a state: fewest days left, treating ~50 km as a day. */
function urgency(status: DueStatus): number {
  const byDays = status.daysRemaining ?? Infinity;
  const byKm = status.kmRemaining !== undefined ? status.kmRemaining / 50 : Infinity;
  return Math.min(byDays, byKm);
}
