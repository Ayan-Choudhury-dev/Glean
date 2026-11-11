import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
}

interface State {
  profile: Profile | null
  houseName: string | null
  items: InventoryItem[]
  createProfile: (name: string) => void
  createPantry: (name: string) => void
  addItem: (item: Omit<InventoryItem, 'id'>) => void
  adjust: (id: string, delta: number) => void
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

      createProfile: (name) =>
        set({ profile: { id: uid(), name: name.trim(), houseId: uid() } }),

      createPantry: (name) => set({ houseName: name.trim() }),

      addItem: (item) => set({ items: [...get().items, { ...item, id: uid() }] }),

      adjust: (id, delta) =>
        set({
          items: get().items.map((i) =>
            i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i,
          ),
        }),

      reset: () => set({ profile: null, houseName: null, items: [] }),
    }),
    { name: 'glean-state' },
  ),
)
