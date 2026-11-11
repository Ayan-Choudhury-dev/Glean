import { useMemo, useState } from 'react'
import { Plus, Minus, Search, LayoutGrid, AlertCircle, XCircle, X, ScanLine } from 'lucide-react'
import { useStore, type InventoryItem } from '../store'
import ScanModal from '../components/ScanModal'
import { lookupProduct } from '../lib/productLookup'

const CATEGORIES = [
  'Dairy', 'Grains', 'Spices', 'Vegetables', 'Fruits', 'Meat & Fish',
  'Beverages', 'Snacks', 'Cleaning', 'Personal Care', 'Other',
]
const LOCATIONS = ['Fridge', 'Freezer', 'Pantry', 'Cupboard', 'Counter', 'Other']

function categoryImage(category: string): string {
  const key = category.toLowerCase().replace(/\s*&\s*/g, '-').replace(/\s+/g, '-')
  return `/categories/${key}.png`
}

type Filter = 'all' | 'low' | 'out' | string

export default function Pantry() {
  const { profile, houseName, items, addItem, adjust, reset } = useStore()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  const categories = useMemo(() => [...new Set(items.map((i) => i.category))].sort(), [items])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((i) => {
      const matchesQuery = !q || i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
      const matchesFilter =
        filter === 'all' ? true : filter === 'low' ? i.qty === 1 : filter === 'out' ? i.qty === 0 : i.category === filter
      return matchesQuery && matchesFilter
    })
  }, [items, query, filter])

  const sections = useMemo(() => {
    const map = new Map<string, InventoryItem[]>()
    for (const item of filtered) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [filtered])

  return (
    <div className="mx-auto min-h-full w-full max-w-2xl pb-32">
      <header className="flex items-center justify-between px-6 pb-2 pt-6">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-none tracking-[-0.5px] text-ink">Pantry</h1>
          <p className="mt-1.5 text-[14px] text-muted">
            {houseName ?? 'My Pantry'} · {items.length} {items.length === 1 ? 'item' : 'items'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={reset} className="px-2 py-2 text-[14px] text-muted hover:text-ink" aria-label="Reset pantry">
            Reset
          </button>
          <button
            onClick={() => setAdding(true)}
            aria-label="Add item"
            className="flex size-10 items-center justify-center rounded-full text-accent hover:bg-surface-muted"
          >
            <Plus size={26} />
          </button>
        </div>
      </header>

      {/* filter chips */}
      <div className="flex gap-2 overflow-x-auto px-6 py-3 [scrollbar-width:none]">
        <Chip label="All" active={filter === 'all'} onPress={() => setFilter('all')}>
          <LayoutGrid size={15} />
        </Chip>
        <Chip label="Low stock" active={filter === 'low'} onPress={() => setFilter(filter === 'low' ? 'all' : 'low')}>
          <AlertCircle size={15} />
        </Chip>
        <Chip label="Out of stock" active={filter === 'out'} onPress={() => setFilter(filter === 'out' ? 'all' : 'out')}>
          <XCircle size={15} />
        </Chip>
        {categories.map((c) => (
          <Chip key={c} label={c} active={filter === c} onPress={() => setFilter(filter === c ? 'all' : c)}>
            <img src={categoryImage(c)} alt="" className="size-[22px] object-contain" />
          </Chip>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="px-6 pt-24 text-center">
          <div className="mx-auto flex size-[72px] items-center justify-center rounded-xl bg-accent-soft">
            <LayoutGrid size={34} className="text-accent" />
          </div>
          <h2 className="mt-4 text-[20px] font-semibold text-ink">Add some groceries</h2>
          <p className="mt-1.5 text-[15px] text-muted">Tap + to add your first item.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-6 pt-20 text-center">
          <Search size={40} className="mx-auto text-faint" />
          <h2 className="mt-4 text-[17px] font-semibold text-ink">No items found</h2>
          <p className="mt-1 text-[14px] text-muted">Try a different search or filter</p>
        </div>
      ) : (
        <div className="mt-2">
          {sections.map(([category, list]) => (
            <section key={category}>
              <div className="flex items-center justify-between px-6 pb-2 pt-5">
                <h2 className="text-[12px] font-bold uppercase tracking-[1.2px] text-muted">{category}</h2>
                <span className="text-[12px] text-muted">{list.length}</span>
              </div>
              <ul>
                {list.map((item, index) => (
                  <li
                    key={item.id}
                    className={`flex min-h-[84px] items-center gap-3.5 px-6 py-2.5 ${index > 0 ? 'border-t border-line-light' : ''}`}
                  >
                    {item.category ? (
                      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-muted">
                        <img src={categoryImage(item.category)} alt="" className="size-[54px] object-contain" />
                      </div>
                    ) : null}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[16px] font-semibold text-ink">{item.name}</div>
                      <div className="mt-0.5 flex items-center gap-2">
                        {item.location && <span className="truncate text-[14px] text-muted">{item.location}</span>}
                        {item.qty === 0 ? (
                          <span className="text-[13px] font-semibold text-danger">Out of stock</span>
                        ) : item.qty === 1 ? (
                          <span className="text-[13px] font-semibold text-[#B45309]">Low stock</span>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => adjust(item.id, -1)}
                        disabled={item.qty === 0}
                        aria-label={`Decrease ${item.name}`}
                        className="flex size-8 items-center justify-center rounded-full bg-surface-muted text-ink hover:bg-line-light disabled:opacity-50"
                      >
                        <Minus size={15} />
                      </button>
                      <span className="min-w-[22px] text-center font-mono text-[16px] tabular-nums text-ink">{item.qty}</span>
                      <button
                        onClick={() => adjust(item.id, 1)}
                        aria-label={`Increase ${item.name}`}
                        className="flex size-8 items-center justify-center rounded-full bg-accent text-white hover:opacity-90"
                      >
                        <Plus size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {/* floating search */}
      <div className="fixed inset-x-0 bottom-20 z-10 px-6">
        <div className="mx-auto flex h-12 max-w-2xl items-center gap-2 rounded-full border border-line-light bg-surface px-4 shadow-[0_6px_16px_rgba(0,0,0,0.12)]">
          <Search size={19} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pantry"
            className="flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
          />
          {query && (
            <button onClick={() => setQuery('')} aria-label="Clear search" className="text-muted hover:text-ink">
              <XCircle size={18} />
            </button>
          )}
        </div>
      </div>

      {adding && <AddSheet onClose={() => setAdding(false)} onAdd={(item) => { addItem(item); setAdding(false) }} />}

      <p className="mt-8 text-center text-[12px] text-faint">
        Signed in as {profile?.name}. Everything stays on this device.
      </p>
    </div>
  )
}

function Chip({ label, active, onPress, children }: {
  label: string
  active: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onPress}
      aria-pressed={active}
      className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-[14px] font-medium transition-colors ${
        active ? 'border-ink bg-surface-muted text-ink' : 'border-line bg-surface text-ink hover:bg-surface-muted'
      }`}
    >
      {children}
      {label}
    </button>
  )
}

function AddSheet({ onClose, onAdd }: {
  onClose: () => void
  onAdd: (item: Omit<InventoryItem, 'id'>) => void
}) {
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [category, setCategory] = useState('Other')
  const [location, setLocation] = useState('Pantry')
  const [barcode, setBarcode] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [looking, setLooking] = useState(false)

  const onScanned = async (code: string) => {
    setScanning(false)
    setBarcode(code)
    setLooking(true)
    const product = await lookupProduct(code)
    setLooking(false)
    if (product?.name) setName(product.name)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onAdd({ name: trimmed, qty: Math.max(0, parseInt(qty, 10) || 0), category, location, barcode: barcode ?? undefined })
  }

  return (
    <>
      {scanning && <ScanModal onClose={() => setScanning(false)} onScan={onScanned} />}
      <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/25" onClick={onClose}>
        <div
          className="w-full max-w-xl rounded-t-2xl bg-surface p-6 pb-10 animate-[rise_.2s_ease-out_both]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[22px] font-bold text-ink">Add an item</h2>
            <button onClick={onClose} aria-label="Close" className="text-muted hover:text-ink">
              <X size={22} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setScanning(true)}
            className="mb-3 flex h-12 w-full items-center justify-center gap-2 rounded-md border-[1.5px] border-line bg-surface text-[15px] font-medium text-ink hover:bg-surface-muted"
          >
            <ScanLine size={18} className="text-accent" />
            Scan a barcode
          </button>

          {barcode && (
            <p className="mb-3 text-center text-[12px] text-muted">
              {looking ? 'Looking up product…' : `Barcode ${barcode}`}
            </p>
          )}

          <form onSubmit={submit} className="space-y-3">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name"
              className="h-14 w-full rounded-md border border-line bg-surface-muted px-4 text-[16px] text-ink outline-none placeholder:text-faint focus:border-accent"
            />
            <div className="flex gap-3">
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="numeric"
                className="h-14 w-20 rounded-md border border-line bg-surface-muted px-4 text-center text-[16px] text-ink outline-none focus:border-accent"
              />
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
            <button className="h-[54px] w-full rounded-md bg-accent text-[15px] font-medium text-white hover:opacity-90">
              Add to pantry
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
