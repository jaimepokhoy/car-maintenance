import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import type { Db } from '@/db/types';
import { useSync } from '@/hooks/use-sync';

/**
 * Runs a local database query and re-runs it whenever the screen regains
 * focus, so lists reflect changes made on other screens, and after a sync
 * brings rows down. Call `reload` after changing data in place on the same
 * screen.
 */
export function useDbQuery<T>(query: (db: Db) => Promise<T>): { data: T | undefined; reload: () => void } {
  const db = useSQLiteContext();
  const [data, setData] = useState<T>();
  const { revision } = useSync();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      query(db).then((result) => {
        if (active) setData(result);
      });
      return () => {
        active = false;
      };
      // `revision` is a dependency only so the focused screen re-reads after a sync pulls changes.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [db, query, revision]),
  );

  const reload = useCallback(() => {
    query(db).then(setData);
  }, [db, query]);

  return { data, reload };
}
