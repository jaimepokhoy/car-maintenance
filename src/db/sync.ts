import {
  advanceCursor,
  isRowRejection,
  pullSince,
  shouldApplyRemote,
  SYNC_KEYS,
  SYNC_TABLES,
  toIsoTimestamp,
  type SyncTable,
} from '@/domain';

import { getSetting, setSetting } from './settings';
import type { Db } from './types';

/** A row as the server stores it: Postgres booleans and arrays, with the owner's `user_id`. */
export type RemoteRow = Record<string, unknown>;

/** The cloud side of sync. `src/lib/sync.ts` implements it with Supabase; tests use a fake. */
export interface SyncRemote {
  /**
   * The signed-in owner's rows changed at or after `since` (all of them when
   * `null`). Must filter on `user_id`: RLS also shows shop staff their linked
   * customers' rows, which never belong in the staff member's own database.
   */
  pull(table: SyncTable, since: string | null): Promise<RemoteRow[]>;
  /**
   * Inserts or updates rows by primary key and returns each one's key columns
   * and `updated_at` as stored. Throws an error with a Postgres `code` when
   * the server refuses the data.
   */
  push(table: SyncTable, rows: RemoteRow[]): Promise<RemoteRow[]>;
}

export interface SyncResult {
  /** Remote rows written to the device. */
  pulled: number;
  /** Local rows the server accepted. */
  pushed: number;
  /** Local rows the server refused; they stay marked for the next sync. */
  rejected: number;
}

type Kind = 'value' | 'timestamp' | 'boolean' | 'textArray';

/**
 * The columns each table syncs and how they differ between SQLite and
 * Postgres. `service_records.receipt_path` stays on the device: it points at
 * a local file until receipt uploads exist.
 */
const COLUMNS: Record<SyncTable, Record<string, Kind>> = {
  vehicles: {
    id: 'value',
    nickname: 'value',
    year: 'value',
    make: 'value',
    model: 'value',
    trim_level: 'value',
    vin: 'value',
    powertrain: 'value',
    odometer_km: 'value',
    odometer_updated_on: 'value',
    tire_set: 'value',
    licence_plate: 'value',
    tire_size: 'value',
    created_at: 'timestamp',
    updated_at: 'timestamp',
    deleted_at: 'timestamp',
  },
  shops: {
    id: 'value',
    place_id: 'value',
    name: 'value',
    address: 'value',
    phone: 'value',
    latitude: 'value',
    longitude: 'value',
    is_favourite: 'boolean',
    created_at: 'timestamp',
    updated_at: 'timestamp',
    deleted_at: 'timestamp',
  },
  maintenance_intervals: {
    vehicle_id: 'value',
    item_id: 'value',
    every_km: 'value',
    every_months: 'value',
    updated_at: 'timestamp',
    deleted_at: 'timestamp',
  },
  service_records: {
    id: 'value',
    vehicle_id: 'value',
    item_ids: 'textArray',
    performed_on: 'value',
    odometer_km: 'value',
    cost_cents: 'value',
    currency: 'value',
    shop_id: 'value',
    notes: 'value',
    created_by_tenant_id: 'value',
    created_at: 'timestamp',
    updated_at: 'timestamp',
    deleted_at: 'timestamp',
  },
  customer_links: {
    id: 'value',
    tenant_id: 'value',
    consented_at: 'timestamp',
    revoked_at: 'timestamp',
    updated_at: 'timestamp',
    deleted_at: 'timestamp',
  },
};

/** The columns each table syncs, as the server names them, for the Supabase `select`. */
export function remoteColumns(table: SyncTable): string[] {
  return [...Object.keys(COLUMNS[table]), 'user_id'];
}

const USER_KEY = 'sync.userId';
const LAST_SYNCED_KEY = 'sync.lastSyncedAt';
const cursorKey = (table: SyncTable) => `sync.cursor.${table}`;

/** Rows per upsert request, well under the API's row limit. */
const PUSH_BATCH = 200;

type LocalRow = Record<string, string | number | null>;

function toRemote(table: SyncTable, row: LocalRow, userId: string): RemoteRow {
  const remote: RemoteRow = { user_id: userId };
  for (const [column, kind] of Object.entries(COLUMNS[table])) {
    const value = row[column];
    if (kind === 'boolean') remote[column] = value === 1;
    else if (kind === 'textArray') remote[column] = JSON.parse(String(value));
    else remote[column] = value;
  }
  return remote;
}

function toLocal(table: SyncTable, row: RemoteRow): LocalRow {
  const local: LocalRow = {};
  for (const [column, kind] of Object.entries(COLUMNS[table])) {
    const value = row[column];
    if (value === null || value === undefined) local[column] = null;
    else if (kind === 'timestamp') local[column] = toIsoTimestamp(String(value));
    else if (kind === 'boolean') local[column] = value ? 1 : 0;
    else if (kind === 'textArray') local[column] = JSON.stringify(value);
    else local[column] = value as string | number;
  }
  return local;
}

const keyWhere = (table: SyncTable) => SYNC_KEYS[table].map((column) => `${column} = ?`).join(' AND ');
const keyValues = (table: SyncTable, row: Record<string, unknown>) =>
  SYNC_KEYS[table].map((column) => row[column] as string);
const keyOf = (table: SyncTable, row: Record<string, unknown>) => JSON.stringify(keyValues(table, row));

/**
 * Ties the device's data to the signed-in account. The first sign-in (or a
 * different account) marks every local row for upload and restarts the pull
 * from the beginning, so data saved before signing in reaches the cloud.
 */
async function adoptUser(db: Db, userId: string): Promise<void> {
  if ((await getSetting(db, USER_KEY)) === userId) return;
  for (const table of SYNC_TABLES) {
    await db.runAsync(`UPDATE ${table} SET dirty = 1`);
    await setSetting(db, cursorKey(table), null);
  }
  await setSetting(db, USER_KEY, userId);
}

/**
 * Writes newer remote rows to the device and moves the table's cursor. Rows
 * are applied one at a time rather than in one transaction, so an owner's
 * edit made meanwhile is never rolled back with a failed pull; a pull that
 * stops halfway leaves the cursor alone and simply runs again.
 */
async function pullTable(db: Db, remote: SyncRemote, table: SyncTable, userId: string): Promise<number> {
  const cursor = await getSetting(db, cursorKey(table));
  const rows = (await remote.pull(table, pullSince(cursor))).filter((row) => row.user_id === userId);
  const columns = Object.keys(COLUMNS[table]);
  const keys = SYNC_KEYS[table];
  const updates = columns.filter((column) => !keys.includes(column));
  const upsert =
    `INSERT INTO ${table} (${columns.join(', ')}, dirty) VALUES (${columns.map(() => '?').join(', ')}, 0) ` +
    `ON CONFLICT (${keys.join(', ')}) DO UPDATE SET ` +
    `${updates.map((column) => `${column} = excluded.${column}`).join(', ')}, dirty = 0`;

  let applied = 0;
  const pulled = rows.map((row) => toLocal(table, row));
  for (const row of pulled) {
    const local = await db.getFirstAsync<{ updated_at: string }>(
      `SELECT updated_at FROM ${table} WHERE ${keyWhere(table)}`,
      keyValues(table, row),
    );
    if (!shouldApplyRemote(local, String(row.updated_at))) continue;
    await db.runAsync(
      upsert,
      columns.map((column) => row[column]),
    );
    applied++;
  }
  await setSetting(db, cursorKey(table), advanceCursor(cursor, pulled as { updated_at: string }[]));
  return applied;
}

/**
 * Sends rows changed on the device. Each accepted row takes the server's
 * `updated_at` and is marked clean, unless the owner changed it again while
 * the request was out. When the server refuses a batch, its rows go one by
 * one so a single bad row doesn't hold back the rest.
 */
async function pushTable(db: Db, remote: SyncRemote, table: SyncTable, userId: string) {
  const columns = Object.keys(COLUMNS[table]);
  const dirty = await db.getAllAsync<LocalRow>(`SELECT ${columns.join(', ')} FROM ${table} WHERE dirty = 1`);
  let pushed = 0;
  let rejected = 0;

  async function send(rows: LocalRow[]): Promise<RemoteRow[]> {
    try {
      return await remote.push(
        table,
        rows.map((row) => toRemote(table, row, userId)),
      );
    } catch (error) {
      if (!isRowRejection((error as { code?: string }).code)) throw error;
      if (rows.length === 1) {
        rejected++;
        return [];
      }
      const stored: RemoteRow[] = [];
      for (const row of rows) stored.push(...(await send([row])));
      return stored;
    }
  }

  for (let start = 0; start < dirty.length; start += PUSH_BATCH) {
    const batch = dirty.slice(start, start + PUSH_BATCH);
    const sentAt = new Map(batch.map((row) => [keyOf(table, row), row.updated_at]));
    for (const stored of await send(batch)) {
      const key = keyOf(table, stored);
      if (!sentAt.has(key)) continue;
      await db.runAsync(
        `UPDATE ${table} SET updated_at = ?, dirty = 0 WHERE ${keyWhere(table)} AND updated_at = ?`,
        toIsoTimestamp(String(stored.updated_at)),
        ...keyValues(table, stored),
        sentAt.get(key) ?? null,
      );
      pushed++;
    }
  }
  return { pushed, rejected };
}

/**
 * One full sync for the signed-in owner: pull every table (newer remote rows
 * win), then push what changed here. Pulling first means a stale local edit
 * loses to a newer one from another device instead of overwriting it.
 */
export async function syncOnce(db: Db, remote: SyncRemote, userId: string, now: Date): Promise<SyncResult> {
  await adoptUser(db, userId);
  const result: SyncResult = { pulled: 0, pushed: 0, rejected: 0 };
  for (const table of SYNC_TABLES) result.pulled += await pullTable(db, remote, table, userId);
  for (const table of SYNC_TABLES) {
    const { pushed, rejected } = await pushTable(db, remote, table, userId);
    result.pushed += pushed;
    result.rejected += rejected;
  }
  await setSetting(db, LAST_SYNCED_KEY, now.toISOString());
  return result;
}

/** When the last sync finished, or `null` if this device has never synced. */
export function getLastSyncedAt(db: Db): Promise<string | null> {
  return getSetting(db, LAST_SYNCED_KEY);
}

/**
 * A summary of the rows waiting to upload. It changes whenever the owner
 * edits something, but not when sync itself writes, so a database change
 * listener can tell local edits from sync's own writes.
 */
export async function pendingChanges(db: Db): Promise<string> {
  const parts: string[] = [];
  for (const table of SYNC_TABLES) {
    const row = await db.getFirstAsync<{ count: number; latest: string | null }>(
      `SELECT COUNT(*) AS count, MAX(updated_at) AS latest FROM ${table} WHERE dirty = 1`,
    );
    if (row?.count) parts.push(`${table}:${row.count}:${row.latest}`);
  }
  return parts.join('|');
}
