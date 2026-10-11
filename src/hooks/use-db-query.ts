import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';

import type { Db } from '@/db/types';

/**
 * Runs a local database query and re-runs it whenever the screen regains
 * focus, so lists reflect changes made on other screens.
 */
export function useDbQuery<T>(query: (db: Db) => Promise<T>): T | undefined {
  const db = useSQLiteContext();
  const [data, setData] = useState<T>();

  useFocusEffect(
    useCallback(() => {
      let active = true;
      query(db).then((result) => {
        if (active) setData(result);
      });
      return () => {
        active = false;
      };
    }, [db, query]),
  );

  return data;
}
