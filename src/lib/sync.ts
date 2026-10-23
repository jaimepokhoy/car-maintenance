import type { SupabaseClient } from '@supabase/supabase-js';

import { remoteColumns, type RemoteRow, type SyncRemote } from '@/db/sync';
import { retryDelayMs, SYNC_KEYS } from '@/domain';

/** Rows per pull request; the API returns at most 1000. */
const PULL_PAGE = 500;

/**
 * Sync's view of Supabase for one signed-in owner. Every pull filters on the
 * owner's `user_id`: shop staff can also read their linked customers' rows
 * through RLS, and those must never be copied into the staff member's own
 * database.
 */
export function createSupabaseRemote(client: SupabaseClient, userId: string): SyncRemote {
  return {
    async pull(table, since) {
      const rows: RemoteRow[] = [];
      for (let from = 0; ; from += PULL_PAGE) {
        let query = client.from(table).select(remoteColumns(table).join(',')).eq('user_id', userId);
        if (since) query = query.gte('updated_at', since);
        let ordered = query.order('updated_at');
        for (const key of SYNC_KEYS[table]) ordered = ordered.order(key);
        const { data, error } = await ordered.range(from, from + PULL_PAGE - 1);
        if (error) throw error;
        const page = (data ?? []) as unknown as RemoteRow[];
        rows.push(...page);
        if (page.length < PULL_PAGE) return rows;
      }
    },

    async push(table, rows) {
      const { data, error } = await client
        .from(table)
        .upsert(rows, { onConflict: SYNC_KEYS[table].join(',') })
        .select([...SYNC_KEYS[table], 'updated_at'].join(','));
      if (error) throw error;
      return (data ?? []) as unknown as RemoteRow[];
    },
  };
}

export type SyncStatus = 'idle' | 'syncing' | 'failed';

export interface SyncScheduler {
  /** Syncs now, or right after the sync already running. */
  syncNow(): void;
  /** Syncs after `delayMs` of quiet, so a burst of edits makes one sync. */
  syncSoon(delayMs: number): void;
  /** Cancels pending syncs and retries. A sync already running finishes on its own. */
  stop(): void;
}

/**
 * Runs `sync` one at a time in the background and retries failures with
 * exponential backoff. Nothing here waits on the network in the caller's
 * path: every request just schedules work.
 */
export function createSyncScheduler(
  sync: () => Promise<void>,
  onStatus: (status: SyncStatus) => void = () => {},
): SyncScheduler {
  let running = false;
  let queued = false;
  let stopped = false;
  let failures = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function schedule(delayMs: number) {
    clearTimeout(timer);
    timer = setTimeout(run, delayMs);
  }

  async function run() {
    clearTimeout(timer);
    if (stopped) return;
    if (running) {
      queued = true;
      return;
    }
    running = true;
    onStatus('syncing');
    try {
      await sync();
      failures = 0;
      onStatus('idle');
    } catch {
      failures++;
      onStatus('failed');
      if (!stopped) schedule(retryDelayMs(failures));
    } finally {
      running = false;
    }
    if (queued && !stopped) {
      queued = false;
      run();
    }
  }

  return {
    syncNow: () => void run(),
    syncSoon: (delayMs) => {
      if (!stopped) schedule(delayMs);
    },
    stop: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
