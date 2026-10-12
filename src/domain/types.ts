/**
 * Core domain types. Distances are always stored in kilometres and money in
 * integer cents; convert only at the display edge (see `units.ts`).
 * Calendar dates are ISO date strings (`YYYY-MM-DD`) with no time zone.
 */

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
  vin?: string;
  powertrain: Powertrain;
  /** Last odometer reading the owner reported. */
  odometerKm: number;
  odometerUpdatedOn: IsoDate;
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
