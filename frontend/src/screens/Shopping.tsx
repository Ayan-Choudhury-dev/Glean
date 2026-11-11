import { useState } from 'react'
import { Plus, Minus, Check, X, ShoppingCart } from 'lucide-react'
import { useStore } from '../store'

export default function Shopping() {
  const { shopping, addToShopping, adjustShopping, togglePurchased, removeFromShopping, updatePantry } = useStore()
  const [name, setName] = useState('')
  const [segment, setSegment] = useState<'to_buy' | 'purchased'>('to_buy')

  const list = shopping.filter((s) => s.status === segment)
  const toBuy = shopping.filter((s) => s.status === 'to_buy').length
  const purchasedCount = shopping.filter((s) => s.status === 'purchased').length

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    addToShopping(name)
    setName('')
  }

  return (
    <div className="mx-auto min-h-dvh w-full max-w-2xl px-6 pb-6 pt-6">
      <h1 className="font-display text-[32px] font-bold leading-none tracking-[-0.5px] text-ink">Shopping list</h1>
      <p className="mt-1.5 text-[14px] text-muted">
        {toBuy} to buy · {purchasedCount} purchased
      </p>

      <form onSubmit={submit} className="mt-5 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add to the list…"
          className="h-12 flex-1 rounded-md border border-line bg-surface-muted px-4 text-[15px] text-ink outline-none placeholder:text-faint focus:border-accent"
        />
        <button aria-label="Add to list" className="flex size-12 items-center justify-center rounded-md bg-accent text-white active:scale-95 hover:opacity-90">
          <Plus size={20} />
        </button>
      </form>

      <div className="mt-5 flex rounded-lg bg-surface-muted p-1">
        {(['to_buy', 'purchased'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setSegment(t)}
            className={`flex-1 rounded-md py-2 text-[14px] font-medium transition-colors ${
              segment === t ? 'bg-surface text-ink shadow-sm' : 'text-muted'
            }`}
          >
            {t === 'to_buy' ? 'To buy' : 'Purchased'}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="pt-16 text-center">
          <ShoppingCart size={40} className="mx-auto text-faint" />
          <p className="mt-3 text-[15px] text-muted">
            {segment === 'to_buy' ? 'Nothing to buy yet.' : 'Nothing purchased yet.'}
          </p>
        </div>
      ) : (
        <ul className="mt-4 overflow-hidden rounded-lg border border-line">
          {list.map((item, i) => (
            <li key={item.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-line-light' : ''}`}>
              <button
                onClick={() => togglePurchased(item.id)}
                aria-label={item.status === 'purchased' ? 'Mark to buy' : 'Mark purchased'}
                className={`flex size-6 items-center justify-center rounded-full border-[1.5px] ${
                  item.status === 'purchased' ? 'border-accent bg-accent text-white' : 'border-line'
                }`}
              >
                {item.status === 'purchased' && <Check size={14} />}
              </button>
              <span className={`flex-1 text-[15px] ${item.status === 'purchased' ? 'text-muted line-through' : 'text-ink'}`}>
                {item.name}
              </span>
              <div className="flex items-center gap-1.5">
                <button onClick={() => adjustShopping(item.id, -1)} aria-label="Decrease" className="flex size-7 items-center justify-center rounded-full bg-surface-muted">
                  <Minus size={14} />
                </button>
                <span className="w-5 text-center font-mono text-[14px] tabular-nums">{item.targetQty}</span>
                <button onClick={() => adjustShopping(item.id, 1)} aria-label="Increase" className="flex size-7 items-center justify-center rounded-full bg-surface-muted">
                  <Plus size={14} />
                </button>
              </div>
              <button onClick={() => removeFromShopping(item.id)} aria-label="Remove" className="text-muted hover:text-ink">
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {purchasedCount > 0 && (
        <button
          onClick={updatePantry}
          className="mt-5 h-[52px] w-full rounded-md bg-accent text-[15px] font-medium text-white active:opacity-80 hover:opacity-90"
        >
          Update pantry ({purchasedCount})
        </button>
      )}
    </div>
  )
}
