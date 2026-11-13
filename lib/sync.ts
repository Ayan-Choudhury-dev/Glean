import { getSupabase } from './supabase';
import {
  getPocketBase,
  pbPushHouse,
  pbPullHouse,
  pbFirstHouseId,
  pbCreatePairingCode,
  pbRedeemPairingCode,
} from './pocketbase';
import { localLoadHouse, localSaveHouse } from './db/client';
import type {
  House,
  InventoryItem,
  ShoppingItem,
  ConsumptionLog,
  HouseOption,
} from '../store/useGleanStore';

// Push/pull between local SQLite and a self-hosted server.
//
// Two backends are supported while the PocketBase migration lands: Postgres +
// PostgREST (the original bundle) and PocketBase (one container, realtime). The
// public functions here are the seam — callers never know which is active.

/** PocketBase is active when its client exists; otherwise PostgREST. */
const usingPocketBase = () => getPocketBase() !== null;

/** Push the local house snapshot to the server (backup). No-op when unconfigured. */
export async function pushHouse(houseId: string): Promise<void> {
  if (usingPocketBase()) return pbPushHouse(houseId);
  const sb = getSupabase();
  if (!sb) return;
  const data = await localLoadHouse(houseId);
  if (!data) return;

  const { house, inventory, shoppingList, consumptionLogs, houseOptions } = data;

  await sb.from('houses').upsert(
    { id: house.id, name: house.name, image_key: house.image_key ?? null, owner_id: house.owner_id },
    { onConflict: 'id' },
  );

  if (inventory.length) {
    await sb.from('inventory').upsert(
      inventory.map((i: InventoryItem) => ({ ...i, house_id: houseId })),
      { onConflict: 'id' },
    );
  }
  if (shoppingList.length) {
    await sb.from('shopping_list').upsert(
      shoppingList.map((s: ShoppingItem) => ({ ...s, house_id: houseId })),
      { onConflict: 'id' },
    );
  }
  if (consumptionLogs.length) {
    await sb.from('consumption_logs').upsert(
      consumptionLogs.map((l: ConsumptionLog) => ({ ...l, house_id: houseId })),
      { onConflict: 'id' },
    );
  }
  if (houseOptions.length) {
    await sb.from('house_options').upsert(
      houseOptions.map((o: HouseOption) => ({ ...o, house_id: houseId })),
      { onConflict: 'id' },
    );
  }
}

/** Pull a house from the server into local SQLite. Returns false if not found. */
export async function pullHouse(houseId: string): Promise<boolean> {
  if (usingPocketBase()) return pbPullHouse(houseId);
  const sb = getSupabase();
  if (!sb) return false;

  const [houseRes, invRes, shopRes, logRes, optRes] = await Promise.all([
    sb.from('houses').select('*').eq('id', houseId).maybeSingle(),
    sb.from('inventory').select('*').eq('house_id', houseId),
    sb.from('shopping_list').select('*').eq('house_id', houseId),
    sb.from('consumption_logs').select('*').eq('house_id', houseId).order('consumed_at', { ascending: false }),
    sb.from('house_options').select('*').eq('house_id', houseId),
  ]);

  if (houseRes.error || !houseRes.data) return false;

  const house = { ...(houseRes.data as unknown as House), members: [] };
  await localSaveHouse(houseId, {
    house,
    inventory: (invRes.data ?? []) as InventoryItem[],
    shoppingList: (shopRes.data ?? []) as ShoppingItem[],
    consumptionLogs: (logRes.data ?? []) as ConsumptionLog[],
    houseOptions: (optRes.data ?? []) as HouseOption[],
  });
  return true;
}

/** The server's single house id (self-hosted single-tenant), if any. */
export async function firstServerHouseId(): Promise<string | null> {
  if (usingPocketBase()) return pbFirstHouseId();
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from('houses').select('id').limit(1);
  return data?.[0]?.id ?? null;
}

// ─── Pairing ───────────────────────────────────────────────────────────────
// A second phone joins by redeeming a short code instead of retyping the
// pantry's id. Codes are minted by the phone that is already connected, live for
// ten minutes, and are consumed on first use. The server has no auth, so the
// code is a convenience, not a security boundary — anyone who can reach the API
// can read the tables anyway.

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
const CODE_LENGTH = 6;
const CODE_TTL_MS = 10 * 60 * 1000;

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

/** Mint a code for this pantry. Returns null when not connected. */
export async function createPairingCode(houseId: string): Promise<string | null> {
  if (usingPocketBase()) return pbCreatePairingCode(houseId);
  const sb = getSupabase();
  if (!sb) return null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const { error } = await sb.from('pairing_codes').insert({
      code,
      house_id: houseId,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    });
    if (!error) return code;
    // 23505 = unique violation; try another code.
    if (!String(error.code ?? '').includes('23505')) return null;
  }
  return null;
}

/** Resolve a code to a pantry id and burn it. Null when invalid or expired. */
export async function redeemPairingCode(code: string): Promise<string | null> {
  if (usingPocketBase()) return pbRedeemPairingCode(code);
  const sb = getSupabase();
  if (!sb) return null;
  const normalized = code.trim().toUpperCase();
  if (normalized.length !== CODE_LENGTH) return null;

  const { data, error } = await sb
    .from('pairing_codes')
    .select('code, house_id, expires_at')
    .eq('code', normalized)
    .limit(1);

  if (error || !data?.length) return null;
  const row = data[0] as { code: string; house_id: string; expires_at: string };
  if (new Date(row.expires_at).getTime() < Date.now()) return null;

  await sb.from('pairing_codes').delete().eq('code', row.code);
  return row.house_id;
}
