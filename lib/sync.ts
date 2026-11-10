import { getSupabase } from './supabase';
import { localLoadHouse, localSaveHouse } from './db/client';
import type {
  House,
  InventoryItem,
  ShoppingItem,
  ConsumptionLog,
  HouseOption,
} from '../store/useGleanStore';

// Push/pull between local SQLite and a self-hosted Supabase (single-tenant).
// Auth is local-only; the server is trusted storage (see schema-selfhost.sql).

/** Push the local house snapshot to the server (backup). No-op when unconfigured. */
export async function pushHouse(houseId: string): Promise<void> {
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
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.from('houses').select('id').limit(1);
  return data?.[0]?.id ?? null;
}
