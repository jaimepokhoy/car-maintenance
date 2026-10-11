import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import type { Db } from '@/db/types';

/**
 * Runs a local database query and re-runs it whenever the screen regains
 * focus, so lists reflect changes made on other screens. Call `reload` after
 * changing data in place on the same screen.
 */
export function useDbQuery<T>(query: (db: Db) => Promise<T>): { data: T | undefined; reload: () => void } {
  const db = useSQLiteContext();
  const [data, setData] = useState<T>();
  const [version, setVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      query(db).then((result) => {
        if (active) setData(result);
      });
      return () => {
        active = false;
      };
    }, [db, query, version]),
  );

  return { data, reload: useCallback(() => setVersion((v) => v + 1), []) };
}
