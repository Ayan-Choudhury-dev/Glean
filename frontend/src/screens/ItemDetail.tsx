import { useState } from 'react'
import { X, Minus, Plus, Trash2 } from 'lucide-react'
import { useStore, type InventoryItem } from '../store'

const CATEGORIES = [
  'Dairy', 'Grains', 'Spices', 'Vegetables', 'Fruits', 'Meat & Fish',
  'Beverages', 'Snacks', 'Cleaning', 'Personal Care', 'Other',
]
const LOCATIONS = ['Fridge', 'Freezer', 'Pantry', 'Cupboard', 'Counter', 'Other']

export default function ItemDetail({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const { editItem, deleteItem, adjust } = useStore()
  const [name, setName] = useState(item.name)
  const [category, setCategory] = useState(item.category)
  const [location, setLocation] = useState(item.location ?? 'Pantry')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const save = () => {
    editItem(item.id, { name: name.trim() || item.name, category, location })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/25" onClick={onClose}>
      <div
        className="w-full max-w-xl rounded-t-2xl bg-surface p-6 pb-10 animate-[sheet-up_.2s_ease-out_both]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-[22px] font-bold text-ink">Edit item</h2>
          <button onClick={onClose} aria-label="Close" className="text-muted active:opacity-60">
            <X size={22} />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-lg bg-surface-muted p-4">
          <span className="text-[15px] text-ink">Quantity</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => adjust(item.id, -1)}
              disabled={item.qty === 0}
              aria-label="Decrease quantity"
              className="flex size-9 items-center justify-center rounded-full bg-surface text-ink active:scale-95 disabled:opacity-50"
            >
              <Minus size={16} />
            </button>
            <span className="min-w-[28px] text-center font-mono text-[18px] tabular-nums text-ink">{item.qty}</span>
            <button
              onClick={() => adjust(item.id, 1)}
              aria-label="Increase quantity"
              className="flex size-9 items-center justify-center rounded-full bg-accent text-white active:scale-95"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Item name"
            className="h-14 w-full rounded-md border border-line bg-surface-muted px-4 text-[16px] text-ink outline-none placeholder:text-faint focus:border-accent"
          />
          <div className="flex gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-14 flex-1 rounded-md border border-line bg-surface-muted px-3 text-[15px] text-ink outline-none focus:border-accent"
            >
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-14 flex-1 rounded-md border border-line bg-surface-muted px-3 text-[15px] text-ink outline-none focus:border-accent"
            >
              {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-4 flex gap-3">
          <button onClick={save} className="h-[54px] flex-1 rounded-md bg-accent text-[15px] font-medium text-white active:opacity-80">
            Save
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            aria-label="Delete item"
            className="flex h-[54px] w-14 items-center justify-center rounded-md border border-line text-danger active:bg-surface-muted"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {confirmDelete && (
          <div className="mt-3 rounded-lg border border-line bg-surface-muted p-4">
            <p className="text-[14px] text-ink">Delete "{item.name}"?</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => { deleteItem(item.id); onClose() }}
                className="h-11 flex-1 rounded-md bg-danger text-[14px] font-medium text-white active:opacity-80"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="h-11 flex-1 rounded-md border border-line text-[14px] font-medium text-ink active:bg-surface"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
