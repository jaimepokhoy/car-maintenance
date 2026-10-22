import {
  type DueStatus,
  type IsoDate,
  type MaintenanceInterval,
  type MaintenanceItemId,
  type Powertrain,
  type ServiceRecord,
  computeVehicleDueStatuses,
  resolveSchedule,
} from './domain';

/** The `customer_links` columns the portal reads. */
export type LinkRow = { user_id: string; consented_at: string };

/** The `vehicles` columns the portal reads. */
export type VehicleRow = {
  id: string;
  user_id: string;
  nickname: string;
  year: number;
  make: string;
  model: string;
  trim_level: string | null;
  licence_plate: string | null;
  powertrain: Powertrain;
  odometer_km: number;
  odometer_updated_on: IsoDate;
};

/** The `service_records` columns the portal reads. */
export type RecordRow = {
  id: string;
  vehicle_id: string;
  item_ids: string[];
  performed_on: IsoDate;
  odometer_km: number;
  cost_cents: number | null;
  currency: 'CAD' | 'USD' | null;
  notes: string | null;
  created_by_tenant_id: string | null;
};

/** The `maintenance_intervals` columns the portal reads (per-vehicle overrides). */
export type IntervalRow = {
  vehicle_id: string;
  item_id: string;
  every_km: number | null;
  every_months: number | null;
};

export const LINK_COLUMNS = 'user_id, consented_at';
export const VEHICLE_COLUMNS =
  'id, user_id, nickname, year, make, model, trim_level, licence_plate, powertrain, odometer_km, odometer_updated_on';
export const RECORD_COLUMNS =
  'id, vehicle_id, item_ids, performed_on, odometer_km, cost_cents, currency, notes, created_by_tenant_id';
export const INTERVAL_COLUMNS = 'vehicle_id, item_id, every_km, every_months';

export type VehicleSummary = {
  vehicle: VehicleRow;
  /** Best known reading: the vehicle's, or a later service's. */
  odometerKm: number;
  /** Overdue and due-soon items, most urgent first. */
  due: DueStatus[];
};

export type CustomerSummary = {
  userId: string;
  consentedAt: string;
  vehicles: VehicleSummary[];
  overdue: number;
  dueSoon: number;
};

export function toServiceRecord(row: RecordRow): ServiceRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    itemIds: row.item_ids as MaintenanceItemId[],
    performedOn: row.performed_on,
    odometerKm: row.odometer_km,
    costCents: row.cost_cents ?? undefined,
    currency: row.currency ?? undefined,
    notes: row.notes ?? undefined,
  };
}

/** The vehicle's schedule: defaults for its powertrain with the owner's overrides on top. */
export function scheduleFor(vehicle: Pick<VehicleRow, 'id' | 'powertrain'>, intervals: IntervalRow[]) {
  const overrides: MaintenanceInterval[] = intervals
    .filter((row) => row.vehicle_id === vehicle.id)
    .map((row) => ({
      itemId: row.item_id as MaintenanceItemId,
      everyKm: row.every_km ?? undefined,
      everyMonths: row.every_months ?? undefined,
    }));
  return resolveSchedule(vehicle.powertrain, overrides);
}

/**
 * The app moves a vehicle's odometer forward when a later service is logged,
 * but staff can't edit vehicles, so a shop's record may be ahead of the
 * vehicle row until the customer's app syncs. Use whichever is higher.
 */
export function effectiveOdometerKm(vehicle: Pick<VehicleRow, 'id' | 'odometer_km'>, records: RecordRow[]): number {
  let km = vehicle.odometer_km;
  for (const record of records) {
    if (record.vehicle_id === vehicle.id && record.odometer_km > km) km = record.odometer_km;
  }
  return km;
}

/** Every item in the vehicle's schedule with its due status, most urgent first. */
export function vehicleDueStatuses(
  vehicle: VehicleRow,
  records: RecordRow[],
  intervals: IntervalRow[],
  today: IsoDate,
): DueStatus[] {
  return computeVehicleDueStatuses(
    scheduleFor(vehicle, intervals),
    { id: vehicle.id, odometerKm: effectiveOdometerKm(vehicle, records) },
    records.map(toServiceRecord),
    today,
  );
}

const isDue = (status: DueStatus) => status.state === 'overdue' || status.state === 'due_soon';

/**
 * One entry per linked customer with their vehicles and what is due. Vehicles
 * of users without a link are ignored: staff of several shops can read every
 * shop's customers, and this list is for one shop. Customers with overdue
 * items come first, then due soon, then the most recently linked.
 */
export function buildCustomerList(
  links: LinkRow[],
  vehicles: VehicleRow[],
  records: RecordRow[],
  intervals: IntervalRow[],
  today: IsoDate,
): CustomerSummary[] {
  const customers = new Map<string, CustomerSummary>();
  for (const link of links) {
    customers.set(link.user_id, { userId: link.user_id, consentedAt: link.consented_at, vehicles: [], overdue: 0, dueSoon: 0 });
  }

  const recordsByVehicle = groupBy(records, (record) => record.vehicle_id);
  const intervalsByVehicle = groupBy(intervals, (interval) => interval.vehicle_id);

  for (const vehicle of vehicles) {
    const customer = customers.get(vehicle.user_id);
    if (!customer) continue;
    const own = recordsByVehicle.get(vehicle.id) ?? [];
    const due = vehicleDueStatuses(vehicle, own, intervalsByVehicle.get(vehicle.id) ?? [], today).filter(isDue);
    customer.vehicles.push({ vehicle, odometerKm: effectiveOdometerKm(vehicle, own), due });
    for (const status of due) {
      if (status.state === 'overdue') customer.overdue += 1;
      else customer.dueSoon += 1;
    }
  }

  for (const customer of customers.values()) {
    customer.vehicles.sort((a, b) => vehicleLabel(a.vehicle).localeCompare(vehicleLabel(b.vehicle)));
  }

  return [...customers.values()].sort(
    (a, b) => b.overdue - a.overdue || b.dueSoon - a.dueSoon || b.consentedAt.localeCompare(a.consentedAt),
  );
}

/** "2020 Honda Civic EX". */
export function vehicleLabel(vehicle: Pick<VehicleRow, 'year' | 'make' | 'model' | 'trim_level'>): string {
  return [vehicle.year, vehicle.make, vehicle.model, vehicle.trim_level].filter(Boolean).join(' ');
}

/** Who logged a record, from the viewing shop's point of view. */
export function recordSource(record: Pick<RecordRow, 'created_by_tenant_id'>, tenantId: string) {
  if (record.created_by_tenant_id === null) return 'customer' as const;
  return record.created_by_tenant_id === tenantId ? ('thisShop' as const) : ('otherShop' as const);
}

/** Newest first, as the app lists them. */
export function sortHistory(records: RecordRow[]): RecordRow[] {
  return [...records].sort(
    (a, b) => b.performed_on.localeCompare(a.performed_on) || b.odometer_km - a.odometer_km,
  );
}

/**
 * Today's calendar date for a Canadian shop. Uses Newfoundland time, the
 * earliest Canadian zone to reach a new day, so no shop is told that today's
 * work is in the future; a few hours' difference doesn't change what is due.
 */
export function canadianToday(now: Date = new Date()): IsoDate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/St_Johns',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}
