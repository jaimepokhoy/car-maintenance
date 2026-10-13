import type { Db } from './types';

/**
 * On-device schema, mirroring `supabase/migrations` plus a `dirty` flag that
 * marks rows changed since the last sync. Append new migrations; never edit
 * one that has shipped. `PRAGMA user_version` records how many have run.
 */
export const MIGRATIONS: string[] = [
  `
  CREATE TABLE vehicles (
    id TEXT PRIMARY KEY NOT NULL,
    nickname TEXT NOT NULL,
    year INTEGER NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    vin TEXT,
    powertrain TEXT NOT NULL CHECK (powertrain IN ('gas', 'hybrid', 'ev')),
    odometer_km INTEGER NOT NULL,
    odometer_updated_on TEXT NOT NULL,
    tire_set TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    dirty INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE maintenance_intervals (
    vehicle_id TEXT NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
    item_id TEXT NOT NULL,
    every_km INTEGER,
    every_months INTEGER,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    dirty INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (vehicle_id, item_id)
  );

  CREATE TABLE shops (
    id TEXT PRIMARY KEY NOT NULL,
    place_id TEXT,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    latitude REAL,
    longitude REAL,
    is_favourite INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    dirty INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE service_records (
    id TEXT PRIMARY KEY NOT NULL,
    vehicle_id TEXT NOT NULL REFERENCES vehicles (id) ON DELETE CASCADE,
    item_ids TEXT NOT NULL,
    performed_on TEXT NOT NULL,
    odometer_km INTEGER NOT NULL,
    cost_cents INTEGER,
    currency TEXT,
    shop_id TEXT REFERENCES shops (id) ON DELETE SET NULL,
    notes TEXT,
    receipt_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    dirty INTEGER NOT NULL DEFAULT 1
  );

  CREATE INDEX service_records_vehicle_idx ON service_records (vehicle_id, performed_on DESC);
  `,
  `
  CREATE TABLE settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  `
  ALTER TABLE vehicles ADD COLUMN trim_level TEXT;
  ALTER TABLE vehicles ADD COLUMN licence_plate TEXT;
  ALTER TABLE vehicles ADD COLUMN tire_size TEXT;
  `,
];

export async function migrate(db: Db): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version++) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(MIGRATIONS[version]);
      await db.execAsync(`PRAGMA user_version = ${version + 1}`);
    });
  }
}
