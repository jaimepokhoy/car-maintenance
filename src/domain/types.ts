/**
 * Core domain types. Distances are always stored in kilometres and money in
 * integer cents; convert only at the display edge (see `units.ts`).
 * Calendar dates are ISO date strings (`YYYY-MM-DD`) with no time zone.
 */

import type { TireSet } from './seasonal-tires';

export type Powertrain = 'gas' | 'hybrid' | 'ev';

export type DistanceUnit = 'km' | 'mi';

export type CurrencyCode = 'CAD' | 'USD';

export type IsoDate = string;

export type MaintenanceItemId =
  | 'oil_change'
  | 'tire_rotation'
  | 'brake_inspection'
  | 'brake_fluid'
  | 'engine_air_filter'
  | 'cabin_air_filter'
  | 'coolant'
  | 'transmission_fluid'
  | 'spark_plugs'
  | 'battery_12v'
  | 'hv_battery_check'
  | 'wiper_blades';

export interface Vehicle {
  id: string;
  nickname: string;
  year: number;
  make: string;
  model: string;
  /** Trim or version, e.g. "EX" or "Limited". */
  trim?: string;
  vin?: string;
  powertrain: Powertrain;
  /** Shops and parking forms ask for it. */
  licencePlate?: string;
  /** As printed on the sidewall, e.g. "225/45R17". Handy when buying winter tires. */
  tireSize?: string;
  /** Last odometer reading the owner reported. */
  odometerKm: number;
  odometerUpdatedOn: IsoDate;
  /** Which tires are on now, for seasonal changeover reminders. */
  tireSet?: TireSet;
}

/** How often an item is due. Whichever limit is reached first wins. */
export interface MaintenanceInterval {
  itemId: MaintenanceItemId;
  everyKm?: number;
  everyMonths?: number;
}

export interface ServiceRecord {
  id: string;
  vehicleId: string;
  itemIds: MaintenanceItemId[];
  performedOn: IsoDate;
  odometerKm: number;
  costCents?: number;
  currency?: CurrencyCode;
  shopId?: string;
  notes?: string;
}

/**
 * Everything an owner pays for that isn't a logged maintenance job: fuel,
 * insurance, plates, parking and the rest. Services stay in service records;
 * spend summaries read both so the totals cover the whole cost of ownership.
 */
export type ExpenseCategory =
  | 'fuel'
  | 'insurance'
  | 'registration'
  | 'repairs'
  | 'tires'
  | 'parking'
  | 'tolls'
  | 'wash'
  | 'other';

export interface Expense {
  id: string;
  vehicleId: string;
  category: ExpenseCategory;
  incurredOn: IsoDate;
  amountCents: number;
  currency?: CurrencyCode;
  /** Optional, but it keeps distance-based costs and reminders accurate. */
  odometerKm?: number;
  shopId?: string;
  notes?: string;
}
