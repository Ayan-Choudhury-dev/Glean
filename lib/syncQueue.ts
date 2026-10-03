import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { supabase } from './supabase';

type Kind = 'insert' | 'update' | 'delete';
type Op = { table: string; kind: Kind; payload?: unknown; id?: string };

const KEY = 'glean:syncQueue';

let ops: Op[] = [];
let flushing = false;
let started = false;

async function persist() {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(ops));
  } catch {
    /* best-effort */
  }
}

async function restore() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    ops = raw ? (JSON.parse(raw) as Op[]) : [];
  } catch {
    ops = [];
  }
}

async function exec(op: Op) {
  if (op.kind === 'insert') {
    return supabase.from(op.table).insert(op.payload as never);
  }
  if (op.kind === 'update') {
    return supabase.from(op.table).update(op.payload as never).eq('id', op.id!);
  }
  return supabase.from(op.table).delete().eq('id', op.id!);
}

/** Replay queued writes in order; stop at the first failure (still offline). */
export async function flushQueue(): Promise<void> {
  if (flushing || ops.length === 0) return;
  flushing = true;
  try {
    while (ops.length > 0) {
      const op = ops[0];
      const { error } = (await exec(op)) as { error: unknown };
      if (error) break;
      ops.shift();
      await persist();
    }
  } catch (e) {
    console.error('[sync] flush failed:', e);
  } finally {
    flushing = false;
  }
}

/** Queue a failed write so it can be retried when the connection returns. */
export function enqueue(op: Op): void {
  if (op.kind === 'update') {
    // Merge repeat updates to the same row instead of stacking them.
    const existing = ops.find(o => o.kind === 'update' && o.table === op.table && o.id === op.id);
    if (existing) {
      existing.payload = { ...(existing.payload as object), ...(op.payload as object) };
      void persist();
      void flushQueue();
      return;
    }
  }
  ops.push(op);
  void persist();
  void flushQueue();
}

export function pendingSyncCount(): number {
  return ops.length;
}

/** Load persisted ops and start periodic / foreground flush attempts. */
export async function initSyncQueue(): Promise<void> {
  if (started) return;
  started = true;
  await restore();
  void flushQueue();
  setInterval(() => {
    if (ops.length > 0) void flushQueue();
  }, 15000);
  AppState.addEventListener('change', state => {
    if (state === 'active') void flushQueue();
  });
}
