import { getDb } from './db/client';

// Self-hosted backend configuration (Supabase URL + anon key), persisted in the
// local SQLite `meta` table. Absent = local-only mode.

export interface ServerConfig {
  url: string;
  anonKey: string;
}

const URL_KEY = 'server_url';
const KEY_KEY = 'server_anon_key';

export async function getServerConfig(): Promise<ServerConfig | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM meta WHERE key IN (?, ?)',
    URL_KEY, KEY_KEY,
  );
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const url = map[URL_KEY];
  const anonKey = map[KEY_KEY];
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export async function saveServerConfig(config: ServerConfig): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', URL_KEY, config.url);
  await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', KEY_KEY, config.anonKey);
}

export async function clearServerConfig(): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM meta WHERE key IN (?, ?)', URL_KEY, KEY_KEY);
}
