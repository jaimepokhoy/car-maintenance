import type { IsoDate, Powertrain, TireSet, Vehicle } from '@/domain';

import type { Db } from './types';

export interface NewVehicle {
  nickname: string;
  year: number;
  make: string;
  model: string;
  vin?: string;
  powertrain: Powertrain;
  odometerKm: number;
}

interface VehicleRow {
  id: string;
  nickname: string;
  year: number;
  make: string;
  model: string;
  vin: string | null;
  powertrain: Powertrain;
  odometer_km: number;
  odometer_updated_on: string;
  tire_set: TireSet | null;
}

function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    nickname: row.nickname,
    year: row.year,
    make: row.make,
    model: row.model,
    vin: row.vin ?? undefined,
    powertrain: row.powertrain,
    odometerKm: row.odometer_km,
    odometerUpdatedOn: row.odometer_updated_on,
    tireSet: row.tire_set ?? undefined,
  };
}

const COLUMNS =
  'id, nickname, year, make, model, vin, powertrain, odometer_km, odometer_updated_on, tire_set';

export async function listVehicles(db: Db): Promise<Vehicle[]> {
  const rows = await db.getAllAsync<VehicleRow>(
    `SELECT ${COLUMNS} FROM vehicles WHERE deleted_at IS NULL ORDER BY created_at`,
  );
  return rows.map(toVehicle);
}

export async function getVehicle(db: Db, id: string): Promise<Vehicle | null> {
  const row = await db.getFirstAsync<VehicleRow>(
    `SELECT ${COLUMNS} FROM vehicles WHERE id = ? AND deleted_at IS NULL`,
    id,
  );
  return row ? toVehicle(row) : null;
}

export async function insertVehicle(
  db: Db,
  id: string,
  input: NewVehicle,
  now: Date,
  today: IsoDate,
): Promise<Vehicle> {
  const timestamp = now.toISOString();
  await db.runAsync(
    `INSERT INTO vehicles (id, nickname, year, make, model, vin, powertrain, odometer_km,
       odometer_updated_on, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.nickname,
    input.year,
    input.make,
    input.model,
    input.vin ?? null,
    input.powertrain,
    input.odometerKm,
    today,
    timestamp,
    timestamp,
  );
  return { id, ...input, odometerUpdatedOn: today };
}

export async function updateOdometer(
  db: Db,
  id: string,
  odometerKm: number,
  now: Date,
  today: IsoDate,
): Promise<void> {
  await db.runAsync(
    `UPDATE vehicles SET odometer_km = ?, odometer_updated_on = ?, updated_at = ?, dirty = 1
     WHERE id = ?`,
    odometerKm,
    today,
    now.toISOString(),
    id,
  );
}

export async function updateTireSet(db: Db, id: string, tireSet: TireSet, now: Date): Promise<void> {
  await db.runAsync(
    'UPDATE vehicles SET tire_set = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    tireSet,
    now.toISOString(),
    id,
  );
}

/** Soft delete, so the deletion can sync to other devices. */
export async function deleteVehicle(db: Db, id: string, now: Date): Promise<void> {
  const timestamp = now.toISOString();
  await db.runAsync(
    'UPDATE vehicles SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
    timestamp,
    timestamp,
    id,
  );
}
