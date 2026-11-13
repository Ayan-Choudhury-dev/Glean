import { getDb } from './db/client';

// Self-hosted backend configuration, persisted in the local SQLite `meta` table.
// Absent = local-only mode.
//
// Two backends exist while the PocketBase migration lands:
//   'postgrest'  the bundled Postgres + PostgREST, keyed by a shared token
//   'pocketbase' one container, keyed by an account on that server
// The stored `anonKey` holds the PostgREST token; `token` holds the PocketBase
// session token.

export type BackendKind = 'postgrest' | 'pocketbase';

export interface ServerConfig {
  url: string;
  anonKey: string;
  /** Defaults to 'postgrest' for configs written before PocketBase existed. */
  backend?: BackendKind;
  /** PocketBase session token, refreshed on sign-in. */
  token?: string;
}

/** The bundled server accepts any key; this is the value we fill in for people. */
export const DEFAULT_SERVER_KEY = 'glean';

/** Accept "box.local:8000", "http://box.local:8000/", "https://x.dev". */
export function normalizeAddress(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

const URL_KEY = 'server_url';
const KEY_KEY = 'server_anon_key';
const BACKEND_KEY = 'server_backend';
const TOKEN_KEY = 'server_token';

export async function getServerConfig(): Promise<ServerConfig | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM meta WHERE key IN (?, ?, ?, ?)',
    URL_KEY, KEY_KEY, BACKEND_KEY, TOKEN_KEY,
  );
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  const url = map[URL_KEY];
  if (!url) return null;
  const backend = (map[BACKEND_KEY] as BackendKind) || 'postgrest';
  // PocketBase is authenticated by its session token, not by a key.
  const anonKey = map[KEY_KEY] ?? '';
  if (backend === 'postgrest' && !anonKey) return null;
  return { url, anonKey, backend, token: map[TOKEN_KEY] };
}

export async function saveServerConfig(config: ServerConfig): Promise<void> {
  const db = await getDb();
  const write = (key: string, value: string) =>
    db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', [key, value]);
  await write(URL_KEY, config.url);
  await write(KEY_KEY, config.anonKey);
  await write(BACKEND_KEY, config.backend ?? 'postgrest');
  await write(TOKEN_KEY, config.token ?? '');
}

/** Store a refreshed PocketBase token without rewriting the rest. */
export async function saveServerToken(token: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', TOKEN_KEY, token);
}

export async function clearServerConfig(): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'DELETE FROM meta WHERE key IN (?, ?, ?, ?)',
    URL_KEY, KEY_KEY, BACKEND_KEY, TOKEN_KEY,
  );
}
