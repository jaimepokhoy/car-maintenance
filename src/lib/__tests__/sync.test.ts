import type { SupabaseClient } from '@supabase/supabase-js';

import { SYNC_TABLES } from '@/domain';

import { createSupabaseRemote, createSyncScheduler, type SyncStatus } from '../sync';

const ME = '11111111-1111-4111-8111-111111111111';

/** Records every query builder call and answers with the given pages, in order. */
function fakeClient(pages: unknown[][]) {
  const calls: [string, ...unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'gte', 'order', 'upsert']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.range = async (...args: unknown[]) => {
    calls.push(['range', ...args]);
    return { data: pages.shift() ?? [], error: null };
  };
  builder.then = (resolve: (value: unknown) => void) => resolve({ data: pages.shift() ?? [], error: null });
  const client = {
    from: (table: string) => {
      calls.push(['from', table]);
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('Supabase remote', () => {
  it.each(SYNC_TABLES)("pulls only the signed-in owner's %s rows", async (table) => {
    const { client, calls } = fakeClient([]);

    await createSupabaseRemote(client, ME).pull(table, '2026-10-22T13:59:00.000Z');

    expect(calls).toContainEqual(['eq', 'user_id', ME]);
    expect(calls).toContainEqual(['gte', 'updated_at', '2026-10-22T13:59:00.000Z']);
    const select = calls.find(([method]) => method === 'select');
    expect(String(select?.[1]).split(',')).toContain('user_id');
  });

  it('pages through large pulls', async () => {
    const full = Array.from({ length: 500 }, (_, i) => ({ id: String(i), user_id: ME }));
    const { client, calls } = fakeClient([full, [{ id: 'last', user_id: ME }]]);

    const rows = await createSupabaseRemote(client, ME).pull('vehicles', null);

    expect(rows).toHaveLength(501);
    expect(calls.filter(([method]) => method === 'range')).toEqual([
      ['range', 0, 499],
      ['range', 500, 999],
    ]);
    expect(calls.filter(([method]) => method === 'eq')).toEqual([
      ['eq', 'user_id', ME],
      ['eq', 'user_id', ME],
    ]);
    expect(calls.some(([method]) => method === 'gte')).toBe(false);
  });

  it('upserts on the primary key and reads back the stored time', async () => {
    const { client, calls } = fakeClient([[{ vehicle_id: 'v', item_id: 'oil_change', updated_at: 'now' }]]);

    const stored = await createSupabaseRemote(client, ME).push('maintenance_intervals', [{ vehicle_id: 'v' }]);

    expect(stored).toEqual([{ vehicle_id: 'v', item_id: 'oil_change', updated_at: 'now' }]);
    expect(calls).toContainEqual(['upsert', [{ vehicle_id: 'v' }], { onConflict: 'vehicle_id,item_id' }]);
    expect(calls).toContainEqual(['select', 'vehicle_id,item_id,updated_at']);
  });
});

describe('sync scheduler', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const flush = () => jest.advanceTimersByTimeAsync(0);

  it('retries failures with growing delays and resets after a success', async () => {
    const outcomes = [false, false, true];
    const sync = jest.fn(async () => {
      if (!outcomes.shift()) throw new Error('offline');
    });
    const statuses: SyncStatus[] = [];
    const scheduler = createSyncScheduler(sync, (status) => statuses.push(status));

    scheduler.syncNow();
    await flush();
    expect(sync).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(14_999);
    expect(sync).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(sync).toHaveBeenCalledTimes(2);

    await jest.advanceTimersByTimeAsync(30_000);
    expect(sync).toHaveBeenCalledTimes(3);
    expect(statuses).toEqual(['syncing', 'failed', 'syncing', 'failed', 'syncing', 'idle']);

    await jest.advanceTimersByTimeAsync(60 * 60_000);
    expect(sync).toHaveBeenCalledTimes(3);
    scheduler.stop();
  });

  it('runs one sync at a time and once more for requests made meanwhile', async () => {
    let finish = () => {};
    const sync = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const scheduler = createSyncScheduler(sync);

    scheduler.syncNow();
    scheduler.syncNow();
    scheduler.syncNow();
    await flush();
    expect(sync).toHaveBeenCalledTimes(1);

    finish();
    await flush();
    expect(sync).toHaveBeenCalledTimes(2);
    finish();
    await flush();
    expect(sync).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });

  it('debounces bursts of edits into one sync', async () => {
    const sync = jest.fn(async () => {});
    const scheduler = createSyncScheduler(sync);

    scheduler.syncSoon(2_000);
    await jest.advanceTimersByTimeAsync(1_500);
    scheduler.syncSoon(2_000);
    await jest.advanceTimersByTimeAsync(1_500);
    expect(sync).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(500);
    expect(sync).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it('does nothing after it is stopped, such as on sign-out', async () => {
    const sync = jest.fn(async () => {
      throw new Error('offline');
    });
    const scheduler = createSyncScheduler(sync);

    scheduler.syncNow();
    await flush();
    scheduler.stop();
    scheduler.syncNow();
    scheduler.syncSoon(10);
    await jest.advanceTimersByTimeAsync(60 * 60_000);
    expect(sync).toHaveBeenCalledTimes(1);
  });
});
