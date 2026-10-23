import { addDatabaseChangeListener, useSQLiteContext } from 'expo-sqlite';
import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { AppState } from 'react-native';

import { getLastSyncedAt, pendingChanges, syncOnce } from '@/db/sync';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { createSupabaseRemote, createSyncScheduler, type SyncStatus } from '@/lib/sync';

/** Quiet time after a local edit before it uploads, so a burst of edits makes one sync. */
const AFTER_EDIT_MS = 2_000;

interface SyncContextValue {
  status: SyncStatus;
  /** When this device last finished a sync, or `null` if it never has. */
  lastSyncedAt: string | null;
  /** Goes up each time a sync brings rows down, so screens can reload. */
  revision: number;
}

const SyncContext = createContext<SyncContextValue>({ status: 'idle', lastSyncedAt: null, revision: 0 });

/**
 * Keeps the device and the cloud in step while the owner is signed in: on
 * sign-in, when the app comes to the foreground and shortly after local
 * edits. The device stays the source of truth for every screen; sync runs in
 * the background and does nothing without Supabase or a session.
 */
export function SyncProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const userId = useSession().session?.user.id;
  const [status, setStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    getLastSyncedAt(db).then(setLastSyncedAt);
  }, [db]);

  useEffect(() => {
    if (!supabase || !userId) return;
    const remote = createSupabaseRemote(supabase, userId);
    let synced = '';

    const scheduler = createSyncScheduler(async () => {
      const result = await syncOnce(db, remote, userId, new Date());
      synced = await pendingChanges(db);
      setLastSyncedAt(await getLastSyncedAt(db));
      if (result.pulled > 0) setRevision((value) => value + 1);
    }, setStatus);

    scheduler.syncNow();
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduler.syncNow();
    });
    // Sync's own writes also fire this listener; only a change in the rows
    // waiting to upload means the owner edited something.
    const changes = addDatabaseChangeListener(() => {
      pendingChanges(db).then((pending) => {
        if (pending && pending !== synced) scheduler.syncSoon(AFTER_EDIT_MS);
      });
    });

    return () => {
      scheduler.stop();
      appState.remove();
      changes.remove();
    };
  }, [db, userId]);

  const value = useMemo(() => ({ status, lastSyncedAt, revision }), [status, lastSyncedAt, revision]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  return useContext(SyncContext);
}
