import type { InventoryItem, Profile, ShoppingItem } from '../store'

export interface ServerConfig {
  url: string
  key: string
}

export interface Snapshot {
  profile: Profile | null
  houseName: string | null
  items: InventoryItem[]
  shopping: ShoppingItem[]
}

export interface Restored {
  houseId: string
  houseName: string
  items: InventoryItem[]
  shopping: ShoppingItem[]
}

function authHeaders(key: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: key,
    Authorization: `Bearer ${key}`,
  }
}

function baseUrl(server: ServerConfig): string {
  return server.url.replace(/\/+$/, '')
}

/** Upsert the whole pantry to the self-hosted backend. */
export async function pushToServer(server: ServerConfig, snapshot: Snapshot): Promise<void> {
  const houseId = snapshot.profile?.houseId
  if (!houseId) return
  const base = baseUrl(server)
  const headers = { ...authHeaders(server.key), Prefer: 'resolution=merge-duplicates' }

  await fetch(`${base}/rest/v1/houses`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ id: houseId, name: snapshot.houseName ?? 'My Pantry' }),
  })

  if (snapshot.items.length) {
    await fetch(`${base}/rest/v1/inventory`, {
      method: 'POST',
      headers,
      body: JSON.stringify(
        snapshot.items.map((i) => ({
          id: i.id,
          house_id: houseId,
          name: i.name,
          qty: i.qty,
          category: i.category,
          location: i.location ?? null,
          barcode: i.barcode ?? null,
        })),
      ),
    })
  }

  if (snapshot.shopping.length) {
    await fetch(`${base}/rest/v1/shopping_list`, {
      method: 'POST',
      headers,
      body: JSON.stringify(
        snapshot.shopping.map((s) => ({
          id: s.id,
          house_id: houseId,
          name: s.name,
          target_qty: s.targetQty,
          status: s.status,
        })),
      ),
    })
  }
}

/** Pull the first house from the backend, or null when it is empty. */
export async function pullFromServer(server: ServerConfig): Promise<Restored | null> {
  const base = baseUrl(server)
  const headers = authHeaders(server.key)

  const housesRes = await fetch(`${base}/rest/v1/houses?select=*&limit=1`, { headers })
  if (!housesRes.ok) return null
  const houses = (await housesRes.json()) as Array<{ id: string; name?: string }>
  const house = houses?.[0]
  if (!house) return null

  const [invRes, shopRes] = await Promise.all([
    fetch(`${base}/rest/v1/inventory?select=*&house_id=eq.${house.id}`, { headers }),
    fetch(`${base}/rest/v1/shopping_list?select=*&house_id=eq.${house.id}`, { headers }),
  ])

  const inv = invRes.ok ? ((await invRes.json()) as any[]) : []
  const shop = shopRes.ok ? ((await shopRes.json()) as any[]) : []

  return {
    houseId: house.id,
    houseName: house.name ?? 'My Pantry',
    items: inv.map((i) => ({
      id: i.id,
      name: i.name,
      qty: i.qty,
      category: i.category,
      location: i.location ?? undefined,
      barcode: i.barcode ?? undefined,
    })),
    shopping: shop.map((s) => ({
      id: s.id,
      name: s.name,
      targetQty: s.target_qty,
      status: s.status,
    })),
  }
}
