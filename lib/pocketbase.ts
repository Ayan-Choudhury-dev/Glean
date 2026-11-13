import PocketBase, { type RecordModel } from 'pocketbase';
import EventSourcePolyfill from 'react-native-sse';
import { localLoadHouse, localSaveHouse } from './db/client';
import type {
  House,
  InventoryItem,
  ShoppingItem,
  ConsumptionLog,
  HouseOption,
} from '../store/useGleanStore';

/**
 * PocketBase backend (one container, SQLite, realtime).
 *
 * Rows keep their uuid in `uid`: PocketBase ids are 15-char alphanumerics, so
 * rewriting them would mean migrating every phone. Everything here reads and
 * writes by `uid`, and the local SQLite schema is untouched.
 */

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

let client: PocketBase | null = null;

export function getPocketBase(): PocketBase | null {
  return client;
}

export function initPocketBase(url: string): PocketBase {
  // PocketBase's realtime uses EventSource, which neither React Native nor
  // Hermes provides. Without this the subscription silently never connects.
  const g = globalThis as unknown as { EventSource?: unknown };
  if (!g.EventSource) g.EventSource = EventSourcePolyfill;

  client = new PocketBase(url);
  // Realtime over SSE; the SDK ships the polyfill React Native needs.
  client.autoCancellation(false);
  return client;
}

export function clearPocketBase(): void {
  try { void client?.realtime.unsubscribe(); } catch { /* ignore */ }
  client = null;
}

/** Is this address a PocketBase? Cheap probe, no auth needed. */
export async function probePocketBase(url: string): Promise<boolean> {
  try {
    const res = await fetch(`${url.replace(/\/+$/, '')}/api/health`, { method: 'GET' });
    if (!res.ok) return false;
    const body = (await res.json()) as { code?: number; message?: string };
    return body?.code === 200;
  } catch {
    return false;
  }
}

export async function loginPocketBase(email: string, password: string): Promise<string | null> {
  if (!client) return 'No server set.';
  try {
    await client.collection('users').authWithPassword(email, password);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Sign-in failed';
  }
}

export function pocketBaseToken(): string {
  return client?.authStore.token ?? '';
}

/** Restore a session from a stored token, so the app does not ask every launch. */
export function restorePocketBaseAuth(token: string): void {
  if (!client || !token) return;
  client.authStore.save(token, null);
}

// ─── Row mapping ─────────────────────────────────────────────────────────────

function toRecord(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/** Upsert by uid: PocketBase has no merge-duplicates, so try create then patch. */
async function upsert(collection: string, row: Record<string, unknown>): Promise<void> {
  if (!client) return;
  try {
    await client.collection(collection).create(toRecord(row));
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status !== 400) throw e;
    const existing = await client
      .collection(collection)
      .getFirstListItem(`uid="${String(row.uid)}"`);
    await client.collection(collection).update(existing.id, toRecord(row));
  }
}

// ─── Push / pull ─────────────────────────────────────────────────────────────

export async function pbPushHouse(houseId: string): Promise<void> {
  if (!client) return;
  const data = await localLoadHouse(houseId);
  if (!data) return;

  const { house, inventory, shoppingList, consumptionLogs, houseOptions } = data;

  await upsert('houses', {
    uid: house.id,
    name: house.name,
    invite_code: house.invite_code,
    owner_id: house.owner_id,
    image_key: house.image_key ?? '',
  });

  for (const item of inventory) {
    await upsert('inventory', { ...item, uid: item.id, house_id: houseId });
  }
  for (const item of shoppingList) {
    await upsert('shopping_list', { ...item, uid: item.id, house_id: houseId });
  }
  for (const log of consumptionLogs) {
    await upsert('consumption_logs', { ...log, uid: log.id, house_id: houseId });
  }
  for (const option of houseOptions) {
    await upsert('house_options', { ...option, uid: option.id, house_id: houseId });
  }
}

export async function pbPullHouse(houseId: string): Promise<boolean> {
  if (!client) return false;
  try {
    const [houses, inventory, shoppingList, consumptionLogs, houseOptions] = await Promise.all([
      client.collection('houses').getFirstListItem(`uid="${houseId}"`),
      client.collection('inventory').getFullList({ filter: `house_id="${houseId}"` }),
      client.collection('shopping_list').getFullList({ filter: `house_id="${houseId}"` }),
      client.collection('consumption_logs').getFullList({ filter: `house_id="${houseId}"` }),
      client.collection('house_options').getFullList({ filter: `house_id="${houseId}"` }),
    ]);

    const house: House = {
      id: houses.uid as string,
      name: houses.name as string,
      invite_code: (houses.invite_code as string) ?? '',
      owner_id: (houses.owner_id as string) ?? '',
      image_key: (houses.image_key as string) || null,
      members: [],
    };

    await localSaveHouse(houseId, {
      house,
      inventory: inventory.map(r => ({
        id: r.uid,
        name: r.name,
        qty: Number(r.qty ?? 0),
        category: (r.category as string) ?? 'Other',
        location: (r.location as string) || undefined,
        image_url: (r.image_url as string) || undefined,
        barcode: (r.barcode as string) || undefined,
        last_restocked: (r.last_restocked as string) || undefined,
      })) as InventoryItem[],
      shoppingList: shoppingList.map(r => ({
        id: r.uid,
        inventory_id: (r.inventory_id as string) || undefined,
        name: r.name,
        target_qty: Number(r.target_qty ?? 1),
        status: (r.status as ShoppingItem['status']) ?? 'to_buy',
      })),
      consumptionLogs: consumptionLogs.map(r => ({
        id: r.uid,
        house_id: houseId,
        inventory_id: (r.inventory_id as string) ?? '',
        item_name: (r.item_name as string) ?? '',
        qty: Number(r.qty ?? 1),
        action: (r.action as ConsumptionLog['action']) ?? 'used',
        consumed_at: (r.consumed_at as string) ?? new Date().toISOString(),
        user_id: (r.user_id as string) ?? null,
      })),
      houseOptions: houseOptions.map(r => ({
        id: r.uid,
        house_id: houseId,
        type: r.type as HouseOption['type'],
        name: r.name as string,
        icon: (r.icon as string) ?? '',
        created_by: (r.created_by as string) ?? '',
      })),
    });
    return true;
  } catch {
    return false;
  }
}

export async function pbFirstHouseId(): Promise<string | null> {
  if (!client) return null;
  try {
    // No filter (an empty one is a 400) and no sort: PocketBase 0.23 collections
    // have no `created` field unless one is added, so sorting on it errors.
    const page = await client.collection('houses').getList(1, 1);
    return (page.items[0]?.uid as string) ?? null;
  } catch {
    return null;
  }
}

// ─── Pairing ─────────────────────────────────────────────────────────────────

function randomCode(): string {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export async function pbCreatePairingCode(houseId: string): Promise<string | null> {
  if (!client) return null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      await client.collection('pairing_codes').create({
        code,
        house_id: houseId,
        expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
      });
      return code;
    } catch {
      /* collision — try another */
    }
  }
  return null;
}

export async function pbRedeemPairingCode(code: string): Promise<string | null> {
  if (!client) return null;
  const normalized = code.trim().toUpperCase();
  if (normalized.length !== 6) return null;
  try {
    const row = await client
      .collection('pairing_codes')
      .getFirstListItem(`code="${normalized}"`);
    if (new Date(row.expires_at as string).getTime() < Date.now()) return null;
    const houseId = row.house_id as string;
    await client.collection('pairing_codes').delete(row.id);
    return houseId;
  } catch {
    return null;
  }
}

// ─── Realtime ────────────────────────────────────────────────────────────────

/**
 * Watch the household's rows. PocketBase pushes a created/updated/deleted event
 * per record; we reload the house rather than patching in place, because the
 * store already knows how to turn a snapshot into state.
 */
export async function pbSubscribe(houseId: string, onChange: () => void): Promise<void> {
  if (!client) return;
  const collections = ['inventory', 'shopping_list', 'house_options', 'houses'];
  await Promise.all(
    collections.map(name =>
      client!
        .collection(name)
        .subscribe('*', (event: { record: RecordModel }) => {
          const rowHouse = event.record?.house_id as string | undefined;
          if (name === 'houses' ? event.record?.uid === houseId : rowHouse === houseId) {
            onChange();
          }
        })
        .catch(() => {}),
    ),
  );
}

export async function pbUnsubscribe(): Promise<void> {
  if (!client) return;
  try { await client.realtime.unsubscribe(); } catch { /* ignore */ }
}
