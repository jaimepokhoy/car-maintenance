import { manufacturerSchedule } from './manufacturer-schedules';
import type { MaintenanceInterval, MaintenanceItemId, Powertrain, Vehicle } from './types';

/**
 * Default intervals by powertrain. These are general guidance for typical
 * Canadian driving, used when the make has no manufacturer schedule on file;
 * owners can override any of them per vehicle.
 */
const GAS: MaintenanceInterval[] = [
  { itemId: 'oil_change', everyKm: 8_000, everyMonths: 6 },
  { itemId: 'tire_rotation', everyKm: 10_000, everyMonths: 12 },
  { itemId: 'brake_inspection', everyKm: 20_000, everyMonths: 12 },
  { itemId: 'brake_fluid', everyMonths: 24 },
  { itemId: 'engine_air_filter', everyKm: 24_000, everyMonths: 24 },
  { itemId: 'cabin_air_filter', everyKm: 24_000, everyMonths: 12 },
  { itemId: 'coolant', everyKm: 100_000, everyMonths: 60 },
  { itemId: 'transmission_fluid', everyKm: 100_000 },
  { itemId: 'spark_plugs', everyKm: 100_000 },
  { itemId: 'battery_12v', everyMonths: 12 },
  { itemId: 'wiper_blades', everyMonths: 12 },
];

const HYBRID: MaintenanceInterval[] = [
  ...GAS,
  { itemId: 'hv_battery_check', everyMonths: 12 },
];

const EV: MaintenanceInterval[] = [
  { itemId: 'tire_rotation', everyKm: 10_000, everyMonths: 12 },
  { itemId: 'brake_inspection', everyKm: 20_000, everyMonths: 12 },
  { itemId: 'brake_fluid', everyMonths: 24 },
  { itemId: 'cabin_air_filter', everyKm: 24_000, everyMonths: 12 },
  { itemId: 'coolant', everyMonths: 48 },
  { itemId: 'battery_12v', everyMonths: 12 },
  { itemId: 'hv_battery_check', everyMonths: 12 },
  { itemId: 'wiper_blades', everyMonths: 12 },
];

const DEFAULTS: Record<Powertrain, MaintenanceInterval[]> = { gas: GAS, hybrid: HYBRID, ev: EV };

export function defaultSchedule(powertrain: Powertrain): MaintenanceInterval[] {
  return DEFAULTS[powertrain].map((interval) => ({ ...interval }));
}

/** Applies per-vehicle overrides on top of a base schedule. */
export function resolveSchedule(
  powertrain: Powertrain,
  overrides: MaintenanceInterval[] = [],
): MaintenanceInterval[] {
  const byItem = new Map<MaintenanceItemId, MaintenanceInterval>(
    defaultSchedule(powertrain).map((interval) => [interval.itemId, interval]),
  );
  for (const override of overrides) {
    byItem.set(override.itemId, { ...override });
  }
  return [...byItem.values()];
}

/**
 * The schedule the app should actually use: the manufacturer's for this make
 * and powertrain when one is on file, otherwise the general defaults, then
 * any per-vehicle overrides on top.
 */
export function resolveVehicleSchedule(
  vehicle: Pick<Vehicle, 'make' | 'powertrain'>,
  overrides: MaintenanceInterval[] = [],
): MaintenanceInterval[] {
  const manufacturer = manufacturerSchedule(vehicle)?.powertrains[vehicle.powertrain];
  if (!manufacturer) return resolveSchedule(vehicle.powertrain, overrides);

  const byItem = new Map<MaintenanceItemId, MaintenanceInterval>(
    manufacturer.map((interval) => [interval.itemId, { ...interval }]),
  );
  for (const override of overrides) {
    byItem.set(override.itemId, { ...override });
  }
  return [...byItem.values()];
}
