import { useMemo, useState } from 'react'
import { useStore, type InventoryItem } from '../store'

const CATEGORIES = [
  'Dairy', 'Grains', 'Spices', 'Vegetables', 'Fruits', 'Meat & Fish',
  'Beverages', 'Snacks', 'Cleaning', 'Personal Care', 'Other',
]
const LOCATIONS = ['Fridge', 'Freezer', 'Pantry', 'Cupboard', 'Counter', 'Other']

function categoryImage(category: string): string {
  const key = category.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-')
  return `/categories/${key}.png`
}

export default function Pantry() {
  const { profile, houseName, items, addItem, adjust, reset } = useStore()
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [category, setCategory] = useState('Other')
  const [location, setLocation] = useState('Pantry')

  const grouped = useMemo(() => {
    const map = new Map<string, InventoryItem[]>()
    for (const item of items) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [items])

  const onAdd = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    addItem({ name: trimmed, qty: Math.max(0, parseInt(qty, 10) || 0), category, location })
    setName('')
    setQty('1')
  }

  return (
    <div className="mx-auto min-h-full w-full max-w-2xl px-5 py-8">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="font-display text-3xl tracking-[-0.02em] text-ink">Pantry</h1>
          <p className="mt-1 text-sm text-muted">
            {houseName ?? 'My Pantry'} · {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <button onClick={reset} className="text-xs text-muted hover:text-ink">
          Reset
        </button>
      </header>

      <form onSubmit={onAdd} className="mt-6 flex flex-wrap gap-2 rounded-2xl border border-line bg-white p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add an item…"
          className="min-w-[10rem] flex-1 rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        />
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputMode="numeric"
          className="w-16 rounded-lg border border-line px-3 py-2 text-center text-sm text-ink outline-none focus:border-accent"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        >
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="rounded-lg border border-line px-3 py-2 text-sm text-ink outline-none focus:border-accent"
        >
          {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
        </select>
        <button className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Add
        </button>
      </form>

      {items.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-2xl">🧺</div>
          <h2 className="mt-4 font-display text-xl text-ink">Add some groceries</h2>
          <p className="mt-1 text-sm text-muted">Add your first item above to start your pantry.</p>
        </div>
      ) : (
        <div className="mt-8 space-y-8">
          {grouped.map(([category, list]) => (
            <section key={category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted">{category}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white">
                {list.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <img src={categoryImage(item.category)} alt="" className="h-10 w-10 object-contain" />
                    <div className="flex-1">
                      <div className="font-medium text-ink">{item.name}</div>
                      <div className="text-xs text-muted">
                        {item.location}
                        {item.qty === 0 && <span className="ml-2 font-semibold text-accent">Out of stock</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StepButton onClick={() => adjust(item.id, -1)} disabled={item.qty === 0}>−</StepButton>
                      <span className="w-6 text-center font-mono text-sm tabular-nums">{item.qty}</span>
                      <StepButton onClick={() => adjust(item.id, 1)} accent>+</StepButton>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-muted">
        Signed in as {profile?.name}. Everything stays on this device.
      </p>
    </div>
  )
}

function StepButton({ children, onClick, disabled, accent }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  accent?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition-opacity disabled:opacity-40 ${
        accent ? 'bg-accent text-white' : 'bg-paper text-ink hover:bg-line'
      }`}
    >
      {children}
    </button>
  )
}
