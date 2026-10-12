import { parsePreferences, type Preferences } from '@/domain';

import type { Db } from './types';

export async function getPreferences(db: Db): Promise<Preferences> {
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  return parsePreferences(Object.fromEntries(rows.map((row) => [row.key, row.value])));
}

export async function setPreference<K extends keyof Preferences>(
  db: Db,
  key: K,
  value: Preferences[K],
): Promise<void> {
  if (value === undefined) {
    await db.runAsync('DELETE FROM settings WHERE key = ?', key);
    return;
  }
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    key,
    String(value),
  );
}
