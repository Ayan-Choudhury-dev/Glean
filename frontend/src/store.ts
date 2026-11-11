import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { storageAdapter } from './lib/storage'

export interface Profile {
  id: string
  name: string
  houseId: string | null
}

export interface InventoryItem {
  id: string
  name: string
  qty: number
  category: string
  location?: string
  barcode?: string
}

export interface ShoppingItem {
  id: string
  name: string
  targetQty: number
  status: 'to_buy' | 'purchased'
}

interface State {
  profile: Profile | null
  houseName: string | null
  items: InventoryItem[]
  shopping: ShoppingItem[]
  server: { url: string; key: string } | null

  createProfile: (name: string) => void
  createPantry: (name: string) => void
  setName: (name: string) => void
  setServer: (server: { url: string; key: string } | null) => void

  addItem: (item: Omit<InventoryItem, 'id'>) => void
  editItem: (id: string, updates: Partial<Omit<InventoryItem, 'id'>>) => void
  deleteItem: (id: string) => void
  adjust: (id: string, delta: number) => void

  addToShopping: (name: string) => void
  adjustShopping: (id: string, delta: number) => void
  togglePurchased: (id: string) => void
  removeFromShopping: (id: string) => void
  updatePantry: () => void

  reset: () => void
}

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2)

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      profile: null,
      houseName: null,
      items: [],
      shopping: [],
      server: null,

      createProfile: (name) =>
        set({ profile: { id: uid(), name: name.trim(), houseId: uid() } }),

      createPantry: (name) => set({ houseName: name.trim() }),

      setName: (name) => {
        const p = get().profile
        if (!p || !name.trim()) return
        set({ profile: { ...p, name: name.trim() } })
      },

      setServer: (server) => set({ server }),

      addItem: (item) => set({ items: [...get().items, { ...item, id: uid() }] }),

      editItem: (id, updates) =>
        set({ items: get().items.map((i) => (i.id === id ? { ...i, ...updates } : i)) }),

      deleteItem: (id) => set({ items: get().items.filter((i) => i.id !== id) }),

      adjust: (id, delta) =>
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i,
          ),
        }),

      addToShopping: (name) => {
        const trimmed = name.trim()
        if (!trimmed) return
        if (get().shopping.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) return
        set({ shopping: [...get().shopping, { id: uid(), name: trimmed, targetQty: 1, status: 'to_buy' }] })
      },

      adjustShopping: (id, delta) =>
        set({
          shopping: get().shopping.map((s) =>
            s.id === id ? { ...s, targetQty: Math.max(1, s.targetQty + delta) } : s,
          ),
        }),

      togglePurchased: (id) =>
        set({
          shopping: get().shopping.map((s) =>
            s.id === id ? { ...s, status: s.status === 'purchased' ? 'to_buy' : 'purchased' } : s,
          ),
        }),

      removeFromShopping: (id) =>
        set({ shopping: get().shopping.filter((s) => s.id !== id) }),

      updatePantry: () => {
        const { shopping, items } = get()
        const purchased = shopping.filter((s) => s.status === 'purchased')
        if (purchased.length === 0) return
        const next = [...items]
        for (const p of purchased) {
          const idx = next.findIndex((i) => i.name.toLowerCase() === p.name.toLowerCase())
          if (idx >= 0) next[idx] = { ...next[idx], qty: next[idx].qty + p.targetQty }
          else next.push({ id: uid(), name: p.name, qty: p.targetQty, category: 'Other', location: 'Pantry' })
        }
        set({ items: next, shopping: shopping.filter((s) => s.status !== 'purchased') })
      },

      reset: () => set({ profile: null, houseName: null, items: [], shopping: [], server: null }),
    }),
    { name: 'glean-state', storage: createJSONStorage(() => storageAdapter) },
  ),
)
