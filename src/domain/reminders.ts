import { addDays, daysBetween } from './dates';
import type { DueStatus } from './due-status';
import { nextTireReminder, type Province, type TireReminder } from './seasonal-tires';
import type { IsoDate, MaintenanceItemId, ServiceRecord, Vehicle } from './types';

/** Typical Canadian driving: about 15,000 km a year. */
export const DEFAULT_DAILY_KM = 42;
/** Remind this many days before an item is due. */
export const REMIND_DAYS_BEFORE = 7;
/** For items already due soon or overdue, nudge again after this many days. */
export const REPEAT_NUDGE_DAYS = 3;
/** Nudge to update the odometer when the reading is this old. */
export const ODOMETER_STALE_DAYS = 30;
/** iOS keeps at most 64 scheduled notifications per app; stay well under. */
export const MAX_REMINDERS = 50;

export type PlannedReminder =
  | {
      kind: 'maintenance';
      vehicleId: string;
      itemId: MaintenanceItemId;
      state: DueStatus['state'];
      fireOn: IsoDate;
      status: DueStatus;
    }
  | { kind: 'odometer'; vehicleId: string; fireOn: IsoDate }
  | { kind: 'tires'; vehicleId: string; fireOn: IsoDate; tires: TireReminder };

/**
 * Average km per day for a vehicle, from the oldest logged service to the
 * current odometer. Falls back to a typical Canadian average until there's at
 * least a month of history to go on.
 */
export function estimateDailyKm(
  vehicle: Pick<Vehicle, 'odometerKm' | 'odometerUpdatedOn'>,
  records: ServiceRecord[],
): number {
  const oldest = records.reduce<ServiceRecord | undefined>(
    (best, record) => (!best || record.performedOn < best.performedOn ? record : best),
    undefined,
  );
  if (!oldest) return DEFAULT_DAILY_KM;
  const days = daysBetween(oldest.performedOn, vehicle.odometerUpdatedOn);
  const km = vehicle.odometerKm - oldest.odometerKm;
  if (days < 30 || km <= 0) return DEFAULT_DAILY_KM;
  return km / days;
}

/**
 * The date an item is expected to fall due: its calendar limit, or the day
 * the odometer should reach its distance limit at the current pace, whichever
 * is sooner.
 */
export function expectedDueDate(status: DueStatus, dailyKm: number, today: IsoDate): IsoDate | undefined {
  const byKm =
    status.kmRemaining !== undefined
      ? addDays(today, Math.max(0, Math.floor(status.kmRemaining / dailyKm)))
      : undefined;
  if (status.dueOn && byKm) return status.dueOn < byKm ? status.dueOn : byKm;
  return status.dueOn ?? byKm;
}

export interface VehicleReminderInput {
  vehicle: Vehicle;
  statuses: DueStatus[];
  records: ServiceRecord[];
}

/**
 * Decides which local notifications to schedule. Seasonal tire reminders
 * need the owner's province and the vehicle's current tire set. The plan is recomputed from
 * scratch whenever the app opens or data changes, so nudges for items that
 * are already due simply move forward while the owner keeps using the app.
 */
export function planReminders(
  vehicles: VehicleReminderInput[],
  today: IsoDate,
  province?: Province,
): PlannedReminder[] {
  const plan: PlannedReminder[] = [];

  for (const { vehicle, statuses, records } of vehicles) {
    const dailyKm = estimateDailyKm(vehicle, records);

    for (const status of statuses) {
      if (status.state === 'unknown') continue;
      const due = expectedDueDate(status, dailyKm, today);
      if (!due) continue;
      const early = addDays(due, -REMIND_DAYS_BEFORE);
      const fireOn = early > today ? early : addDays(today, REPEAT_NUDGE_DAYS);
      plan.push({ kind: 'maintenance', vehicleId: vehicle.id, itemId: status.itemId, state: status.state, fireOn, status });
    }

    const staleOn = addDays(vehicle.odometerUpdatedOn, ODOMETER_STALE_DAYS);
    plan.push({
      kind: 'odometer',
      vehicleId: vehicle.id,
      fireOn: staleOn > today ? staleOn : addDays(today, REPEAT_NUDGE_DAYS),
    });

    if (province && vehicle.tireSet) {
      const tires = nextTireReminder(today, province, vehicle.tireSet);
      const fireOn = tires.remindOn > today ? tires.remindOn : addDays(today, REPEAT_NUDGE_DAYS);
      plan.push({ kind: 'tires', vehicleId: vehicle.id, fireOn, tires });
    }
  }

  return plan.sort((a, b) => a.fireOn.localeCompare(b.fireOn)).slice(0, MAX_REMINDERS);
}
