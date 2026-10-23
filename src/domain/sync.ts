/**
 * Rules for cloud sync: which tables sync and in what order, when a remote
 * row replaces the local one (last write wins per row), how the pull cursor
 * moves, and how long to wait before retrying a failed sync.
 */

/** Synced tables, parents first so foreign keys resolve on both sides. */
export const SYNC_TABLES = ['vehicles', 'shops', 'maintenance_intervals', 'service_records', 'customer_links'] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

/** The columns that identify a row, matching each table's primary key. */
export const SYNC_KEYS: Record<SyncTable, readonly string[]> = {
  vehicles: ['id'],
  shops: ['id'],
  maintenance_intervals: ['vehicle_id', 'item_id'],
  service_records: ['id'],
  customer_links: ['id'],
};

/**
 * How far before the cursor each pull starts. The server stamps `updated_at`
 * when a write begins, so a write still committing as the last pull ran can
 * carry a slightly older time; the overlap picks it up. Rows fetched twice
 * are skipped by `shouldApplyRemote`.
 */
export const PULL_OVERLAP_MS = 60_000;

/** Normalizes a Postgres or ISO timestamp to the ISO form stored on the device, e.g. `2026-10-22T14:05:09.123Z`. */
export function toIsoTimestamp(value: string): string {
  return new Date(value).toISOString();
}

/** Compares two timestamps by instant, whatever their format. */
export function compareTimestamps(a: string, b: string): number {
  return Date.parse(a) - Date.parse(b);
}

/**
 * Last write wins: a remote row replaces the local one only when the device
 * doesn't have it yet or the remote copy was written later. An equal time is
 * the same write coming back, so it is skipped. A pending local edit that is
 * older than the remote row loses, the same as any other row.
 */
export function shouldApplyRemote(local: { updated_at: string } | null, remoteUpdatedAt: string): boolean {
  return !local || compareTimestamps(remoteUpdatedAt, local.updated_at) > 0;
}

/** The `updated_at` lower bound for the next pull, or `null` to pull everything. */
export function pullSince(cursor: string | null): string | null {
  return cursor ? new Date(Date.parse(cursor) - PULL_OVERLAP_MS).toISOString() : null;
}

/** Moves the cursor to the newest `updated_at` pulled. It never goes backwards. */
export function advanceCursor(cursor: string | null, pulled: readonly { updated_at: string }[]): string | null {
  let next = cursor;
  for (const row of pulled) {
    if (!next || compareTimestamps(row.updated_at, next) > 0) next = toIsoTimestamp(row.updated_at);
  }
  return next;
}

const FIRST_RETRY_MS = 15_000;
const MAX_RETRY_MS = 15 * 60_000;

/** Exponential backoff after `failures` failed syncs in a row (1 = the first failure): 15 s, 30 s, 1 min… up to 15 min. */
export function retryDelayMs(failures: number): number {
  return Math.min(FIRST_RETRY_MS * 2 ** Math.max(failures - 1, 0), MAX_RETRY_MS);
}

/**
 * Postgres error classes that mean the server refused the row itself (bad
 * data, a constraint, row-level security), so retrying it won't help.
 * Anything else, like a dropped connection, fails the whole sync and retries.
 */
export function isRowRejection(code: string | undefined): boolean {
  return !!code && (code.startsWith('22') || code.startsWith('23') || code === '42501');
}
