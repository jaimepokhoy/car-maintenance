import type { SQLiteDatabase } from 'expo-sqlite';

/** The subset of expo-sqlite the data layer uses, so tests can supply an in-memory database. */
export type Db = Pick<
  SQLiteDatabase,
  'execAsync' | 'runAsync' | 'getAllAsync' | 'getFirstAsync' | 'withTransactionAsync'
>;
