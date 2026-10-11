import { kmToDisplay } from './units';
import type { DistanceUnit, MaintenanceItemId, ServiceRecord, Vehicle } from './types';

/** Quotes a CSV cell when it holds a comma, quote or line break (RFC 4180). */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export interface HistoryCsvOptions {
  unit: DistanceUnit;
  /** Column headings in the owner's language, in the order of the columns below. */
  headers: {
    vehicle: string;
    date: string;
    services: string;
    odometer: string;
    cost: string;
    currency: string;
    shop: string;
    notes: string;
  };
  itemLabel: (itemId: MaintenanceItemId) => string;
  shopName: (shopId: string) => string | undefined;
}

function vehicleLabel(vehicle: Vehicle): string {
  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  return vehicle.nickname ? `${vehicle.nickname} (${name})` : name;
}

/**
 * Every service across the owner's vehicles as spreadsheet rows, newest first.
 * Costs are plain decimals and dates ISO so spreadsheets read them as numbers
 * and dates in any locale.
 */
export function serviceHistoryCsv(
  vehicles: Vehicle[],
  records: ServiceRecord[],
  options: HistoryCsvOptions,
): string {
  const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const { headers } = options;
  const rows = [
    [
      headers.vehicle,
      headers.date,
      headers.services,
      headers.odometer,
      headers.cost,
      headers.currency,
      headers.shop,
      headers.notes,
    ],
  ];
  const sorted = [...records].sort((a, b) => b.performedOn.localeCompare(a.performedOn));
  for (const record of sorted) {
    const vehicle = byId.get(record.vehicleId);
    if (!vehicle) continue;
    rows.push([
      vehicleLabel(vehicle),
      record.performedOn,
      record.itemIds.map(options.itemLabel).join('; '),
      String(Math.round(kmToDisplay(record.odometerKm, options.unit))),
      record.costCents === undefined ? '' : (record.costCents / 100).toFixed(2),
      record.costCents === undefined ? '' : (record.currency ?? 'CAD'),
      (record.shopId && options.shopName(record.shopId)) || '',
      record.notes ?? '',
    ]);
  }
  return toCsv(rows);
}
