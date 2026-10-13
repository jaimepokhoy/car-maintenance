import type { IsoDate, Powertrain, TireSet, ValidVehicle, ValidVehicleDetails, Vehicle } from '@/domain';

import type { Db } from './types';

export type NewVehicle = ValidVehicle;
export type VehicleDetails = ValidVehicleDetails;

interface VehicleRow {
  id: string;
  nickname: string;
  year: number;
  make: string;
  model: string;
  trim_level: string | null;
  vin: string | null;
  powertrain: Powertrain;
  odometer_km: number;
  odometer_updated_on: string;
  tire_set: TireSet | null;
  licence_plate: string | null;
  tire_size: string | null;
}

function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    nickname: row.nickname,
    year: row.year,
    make: row.make,
    model: row.model,
    trim: row.trim_level ?? undefined,
    vin: row.vin ?? undefined,
    powertrain: row.powertrain,
    odometerKm: row.odometer_km,
    odometerUpdatedOn: row.odometer_updated_on,
    tireSet: row.tire_set ?? undefined,
    licencePlate: row.licence_plate ?? undefined,
    tireSize: row.tire_size ?? undefined,
  };
}

const COLUMNS =
  'id, nickname, year, make, model, trim_level, vin, powertrain, odometer_km, odometer_updated_on, tire_set, ' +
  'licence_plate, tire_size';

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
    `INSERT INTO vehicles (id, nickname, year, make, model, trim_level, vin, powertrain, odometer_km,
       odometer_updated_on, licence_plate, tire_size, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.nickname,
    input.year,
    input.make,
    input.model,
    input.trim ?? null,
    input.vin ?? null,
    input.powertrain,
    input.odometerKm,
    today,
    input.licencePlate ?? null,
    input.tireSize ?? null,
    timestamp,
    timestamp,
  );
  return { id, ...input, odometerUpdatedOn: today };
}

/** Saves edits from the vehicle form. The odometer and tire set have their own updates. */
export async function updateVehicleDetails(db: Db, id: string, details: VehicleDetails, now: Date): Promise<void> {
  await db.runAsync(
    `UPDATE vehicles SET nickname = ?, year = ?, make = ?, model = ?, trim_level = ?, vin = ?, powertrain = ?,
       licence_plate = ?, tire_size = ?, updated_at = ?, dirty = 1
     WHERE id = ? AND deleted_at IS NULL`,
    details.nickname,
    details.year,
    details.make,
    details.model,
    details.trim ?? null,
    details.vin ?? null,
    details.powertrain,
    details.licencePlate ?? null,
    details.tireSize ?? null,
    now.toISOString(),
    id,
  );
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

/**
 * Soft deletes the vehicle and its service history, so the deletion can sync
 * to other devices and the history drops out of totals and exports.
 */
export async function deleteVehicle(db: Db, id: string, now: Date): Promise<void> {
  const timestamp = now.toISOString();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE service_records SET deleted_at = ?, updated_at = ?, dirty = 1
       WHERE vehicle_id = ? AND deleted_at IS NULL`,
      timestamp,
      timestamp,
      id,
    );
    await db.runAsync(
      'UPDATE vehicles SET deleted_at = ?, updated_at = ?, dirty = 1 WHERE id = ?',
      timestamp,
      timestamp,
      id,
    );
  });
}
