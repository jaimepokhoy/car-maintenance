import type { MaintenanceItemId, ServiceRecord } from '@/domain';

import type { Db } from './types';

interface ServiceRecordRow {
  id: string;
  vehicle_id: string;
  item_ids: string;
  performed_on: string;
  odometer_km: number;
  cost_cents: number | null;
  currency: ServiceRecord['currency'] | null;
  shop_id: string | null;
  notes: string | null;
}

function toServiceRecord(row: ServiceRecordRow): ServiceRecord {
  return {
    id: row.id,
    vehicleId: row.vehicle_id,
    itemIds: JSON.parse(row.item_ids) as MaintenanceItemId[],
    performedOn: row.performed_on,
    odometerKm: row.odometer_km,
    costCents: row.cost_cents ?? undefined,
    currency: row.currency ?? undefined,
    shopId: row.shop_id ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export async function listServiceRecords(db: Db, vehicleId: string): Promise<ServiceRecord[]> {
  const rows = await db.getAllAsync<ServiceRecordRow>(
    `SELECT id, vehicle_id, item_ids, performed_on, odometer_km, cost_cents, currency, shop_id, notes
     FROM service_records
     WHERE vehicle_id = ? AND deleted_at IS NULL
     ORDER BY performed_on DESC, odometer_km DESC`,
    vehicleId,
  );
  return rows.map(toServiceRecord);
}

export async function insertServiceRecord(db: Db, record: ServiceRecord, now: Date): Promise<void> {
  const timestamp = now.toISOString();
  await db.runAsync(
    `INSERT INTO service_records (id, vehicle_id, item_ids, performed_on, odometer_km, cost_cents,
       currency, shop_id, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    record.id,
    record.vehicleId,
    JSON.stringify(record.itemIds),
    record.performedOn,
    record.odometerKm,
    record.costCents ?? null,
    record.currency ?? null,
    record.shopId ?? null,
    record.notes ?? null,
    timestamp,
    timestamp,
  );
}
