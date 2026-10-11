import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { Db } from '@/db/types';

type Params = SQLInputValue[];

function flatten(params: unknown[]): Params {
  return (params.length === 1 && Array.isArray(params[0]) ? params[0] : params) as Params;
}

/** An in-memory stand-in for expo-sqlite, backed by Node's built-in SQLite. */
export function createMemoryDb(): Db {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    async execAsync(source: string) {
      sqlite.exec(source);
    },
    async runAsync(source: string, ...params: unknown[]) {
      const result = sqlite.prepare(source).run(...flatten(params));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getAllAsync(source: string, ...params: unknown[]) {
      return sqlite.prepare(source).all(...flatten(params));
    },
    async getFirstAsync(source: string, ...params: unknown[]) {
      return sqlite.prepare(source).get(...flatten(params)) ?? null;
    },
    async withTransactionAsync(task: () => Promise<void>) {
      sqlite.exec('BEGIN');
      try {
        await task();
        sqlite.exec('COMMIT');
      } catch (error) {
        sqlite.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return db as unknown as Db;
}
