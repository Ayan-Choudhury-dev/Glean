import { AppState } from 'react-native';
import { supabase } from '../supabase';
import { getDb } from './client';

// SQLite-backed outbox of Supabase writes. Writes land here first (the local DB
// is the source of truth) and replay to Supabase when a connection is available.

type Kind = 'insert' | 'update' | 'delete';

export interface SyncOp {
  table: string;
  kind: Kind;
  payload?: unknown;
  id?: string;
}

let draining: Promise<void> | null = null;
let started = false;

async function exec(op: SyncOp) {
  if (op.kind === 'insert') {
    // Upsert on the primary key so a retried insert can't duplicate a row.
    return supabase.from(op.table).upsert(op.payload as never, { onConflict: 'id' });
  }
  if (op.kind === 'update') {
    return supabase.from(op.table).update(op.payload as never).eq('id', op.id!);
  }
  return supabase.from(op.table).delete().eq('id', op.id!);
}

/** Enqueue a Supabase write; merge repeat updates to the same row. */
export async function enqueueSyncOp(op: SyncOp): Promise<void> {
  const db = await getDb();
  if (op.kind === 'update') {
    const existing = await db.getFirstAsync<{ id: number; payload: string | null }>(
      'SELECT id, payload FROM pending_ops WHERE kind = ? AND table_name = ? AND row_id = ?',
      'update', op.table, op.id ?? null,
    );
    if (existing) {
      const merged = {
        ...(existing.payload ? (JSON.parse(existing.payload) as object) : {}),
        ...(op.payload as object),
      };
      await db.runAsync('UPDATE pending_ops SET payload = ? WHERE id = ?', JSON.stringify(merged), existing.id);
      void drainSyncQueue();
      return;
    }
  }
  await db.runAsync(
    'INSERT INTO pending_ops (kind, table_name, row_id, payload) VALUES (?, ?, ?, ?)',
    op.kind, op.table, op.id ?? null, JSON.stringify(op.payload ?? null),
  );
  void drainSyncQueue();
}

/** Replay queued writes in order; stop at the first failure (still offline). */
export function drainSyncQueue(): Promise<void> {
  // Return the in-flight drain so concurrent callers await the same run instead
  // of racing a second one.
  if (draining) return draining;
  draining = (async () => {
    try {
      const db = await getDb();
      const rows = await db.getAllAsync<{
        id: number; kind: Kind; table_name: string; row_id: string | null; payload: string | null;
      }>('SELECT * FROM pending_ops ORDER BY id ASC');
      for (const row of rows) {
        const op: SyncOp = {
          kind: row.kind,
          table: row.table_name,
          id: row.row_id ?? undefined,
          payload: row.payload ? JSON.parse(row.payload) : undefined,
        };
        const { error } = (await exec(op)) as { error: unknown };
        if (error) break; // still offline — retry later
        await db.runAsync('DELETE FROM pending_ops WHERE id = ?', row.id);
      }
    } catch (e) {
      console.error('[sync] drain failed:', e);
    } finally {
      draining = null;
    }
  })();
  return draining;
}

export async function pendingSyncCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM pending_ops');
  return row?.c ?? 0;
}

/** Start the sync loop: drain on boot, on foreground, and every 15s. */
export async function initSyncQueue(): Promise<void> {
  if (started) return;
  started = true;
  void drainSyncQueue();
  setInterval(() => void drainSyncQueue(), 15000);
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void drainSyncQueue();
  });
}
