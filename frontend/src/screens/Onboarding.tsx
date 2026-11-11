import { useState } from 'react'
import { useStore } from '../store'

type Step = 'welcome' | 'name' | 'staples' | 'where'

const STAPLES = [
  { name: 'Milk', category: 'Dairy', location: 'Fridge' },
  { name: 'Eggs', category: 'Dairy', location: 'Fridge' },
  { name: 'Butter', category: 'Dairy', location: 'Fridge' },
  { name: 'Bread', category: 'Grains', location: 'Pantry' },
  { name: 'Rice', category: 'Grains', location: 'Pantry' },
  { name: 'Pasta', category: 'Grains', location: 'Pantry' },
  { name: 'Coffee', category: 'Beverages', location: 'Pantry' },
  { name: 'Tea', category: 'Beverages', location: 'Pantry' },
  { name: 'Tomatoes', category: 'Vegetables', location: 'Fridge' },
  { name: 'Onions', category: 'Vegetables', location: 'Pantry' },
  { name: 'Bananas', category: 'Fruits', location: 'Counter' },
  { name: 'Apples', category: 'Fruits', location: 'Fridge' },
]

const HERO = ['vegetables', 'dairy', 'fruits', 'grains', 'spices']

const VALUE_POINTS = [
  { icon: '🧺', text: 'Know what you already have' },
  { icon: '⏳', text: 'See what is running low' },
  { icon: '🛒', text: 'Build a shopping list in seconds' },
]

const ORDER: Step[] = ['welcome', 'name', 'staples', 'where']

export default function Onboarding() {
  const { createProfile, createPantry, addItem } = useStore()
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [serverMode, setServerMode] = useState(false)
  const [serverUrl, setServerUrl] = useState('')
  const [serverKey, setServerKey] = useState('')
  const [busy, setBusy] = useState(false)

  const stepIndex = ORDER.indexOf(step)

  const toggle = (stapleName: string) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(stapleName)) next.delete(stapleName)
      else next.add(stapleName)
      return next
    })
  }

  const finish = () => {
    if (busy) return
    setBusy(true)
    createProfile(name)
    createPantry('My Pantry')
    STAPLES.forEach((s) => {
      if (picked.has(s.name)) addItem({ name: s.name, qty: 1, category: s.category, location: s.location })
    })
    // Server wiring lands with the backend sync layer; the choice is captured now.
    if (serverMode && serverUrl.trim() && serverKey.trim()) {
      localStorage.setItem('glean-server', JSON.stringify({ url: serverUrl.trim(), key: serverKey.trim() }))
    }
    setBusy(false)
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col justify-center px-7 py-10">
      {/* progress */}
      <div className="mb-8 flex justify-center gap-2">
        {ORDER.map((_, i) => (
          <span
            key={i}
            className={`h-[7px] rounded-full transition-all ${
              i <= stepIndex ? 'bg-accent' : 'bg-line'
            } ${i === stepIndex ? 'w-[22px]' : 'w-[7px]'}`}
          />
        ))}
      </div>

      <div key={step} className="animate-[rise_.4s_cubic-bezier(.2,.8,.2,1)_both]">
        {step === 'welcome' && (
          <div>
            <div className="text-center">
              <h1 className="font-display text-[2.6rem] leading-[1.05] tracking-[-0.03em] text-ink">
                Your kitchen, remembered.
              </h1>
              <p className="mx-auto mt-3 max-w-md text-muted">
                Glean keeps track of what you have, so you shop once and stop running out.
              </p>
              <div className="mt-6 flex items-end justify-center gap-2">
                {HERO.map((c, i) => (
                  <img
                    key={c}
                    src={`/categories/${c}.png`}
                    alt=""
                    className="h-14 w-14 object-contain"
                    style={{ animation: 'rise .6s cubic-bezier(.2,.8,.2,1) both', animationDelay: `${i * 80}ms` }}
                  />
                ))}
              </div>
            </div>

            <ul className="mt-8 space-y-4">
              {VALUE_POINTS.map((p) => (
                <li key={p.text} className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-lg">
                    {p.icon}
                  </span>
                  <span className="text-ink">{p.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 'name' && (
          <div>
            <h2 className="font-display text-[1.9rem] leading-tight tracking-[-0.02em] text-ink">
              What should we call you?
            </h2>
            <p className="mt-2 text-muted">Just a first name is fine. It stays on this device.</p>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && name.trim() && setStep('staples')}
              placeholder="Your name"
              className="mt-6 h-14 w-full rounded-xl border border-line bg-white px-4 text-ink outline-none focus:border-accent"
            />
          </div>
        )}

        {step === 'staples' && (
          <div>
            <h2 className="font-display text-[1.9rem] leading-tight tracking-[-0.02em] text-ink">
              What is usually in your kitchen?
            </h2>
            <p className="mt-2 text-muted">Tap a few staples to start your pantry. You can add anything else later.</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              {STAPLES.map((s) => {
                const on = picked.has(s.name)
                return (
                  <button
                    key={s.name}
                    onClick={() => toggle(s.name)}
                    aria-pressed={on}
                    className={`flex min-h-[46px] items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-medium transition-colors ${
                      on
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line bg-white text-ink hover:border-muted'
                    }`}
                  >
                    <span aria-hidden>{on ? '✓' : '+'}</span>
                    {s.name}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {step === 'where' && (
          <div>
            <h2 className="font-display text-[1.9rem] leading-tight tracking-[-0.02em] text-ink">
              Where should your pantry live?
            </h2>
            <p className="mt-2 text-muted">
              Glean works on this device. You can also sync through a server you host yourself.
            </p>

            <div className="mt-5 space-y-3">
              <Choice
                selected={!serverMode}
                title="On this device"
                subtitle="Private, works offline, nothing to set up"
                onSelect={() => setServerMode(false)}
              />
              <Choice
                selected={serverMode}
                title="My own server"
                subtitle="Sync across devices through a server you run"
                onSelect={() => setServerMode(true)}
              />
            </div>

            {serverMode && (
              <div className="mt-4 space-y-3">
                <input
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://my-server:8000"
                  className="h-13 w-full rounded-xl border border-line bg-white px-4 text-ink outline-none focus:border-accent"
                />
                <input
                  value={serverKey}
                  onChange={(e) => setServerKey(e.target.value)}
                  placeholder="Anon key (any non-empty value)"
                  className="h-13 w-full rounded-xl border border-line bg-white px-4 text-ink outline-none focus:border-accent"
                />
                <p className="text-xs text-muted">Run the bundled backend first — see backend/README.md.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* actions */}
      <div className="mt-8 space-y-2.5">
        {step === 'welcome' && <Primary onClick={() => setStep('name')}>Get started</Primary>}

        {step === 'name' && (
          <>
            <Primary onClick={() => setStep('staples')} disabled={!name.trim()}>
              Continue
            </Primary>
            <Secondary onClick={() => setStep('welcome')}>Back</Secondary>
          </>
        )}

        {step === 'staples' && (
          <>
            <Primary onClick={() => setStep('where')} disabled={picked.size === 0}>
              {picked.size > 0 ? `Add ${picked.size} ${picked.size === 1 ? 'item' : 'items'}` : 'Add items'}
            </Primary>
            <Secondary onClick={() => setStep('where')}>Skip for now</Secondary>
          </>
        )}

        {step === 'where' && (
          <>
            <Primary
              onClick={finish}
              disabled={busy || (serverMode && (!serverUrl.trim() || !serverKey.trim()))}
            >
              {serverMode ? 'Connect & finish' : 'Finish setup'}
            </Primary>
            <Secondary onClick={() => setStep('staples')}>Back</Secondary>
          </>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-muted">
        Your pantry lives on this device. No account needed.
      </p>
    </div>
  )
}

function Choice({
  selected,
  title,
  subtitle,
  onSelect,
}: {
  selected: boolean
  title: string
  subtitle: string
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-center gap-3.5 rounded-2xl border-[1.5px] p-4 text-left transition-colors ${
        selected ? 'border-accent bg-accent-soft' : 'border-line bg-white hover:border-muted'
      }`}
    >
      <div className="flex-1">
        <div className="font-medium text-ink">{title}</div>
        <div className="mt-0.5 text-xs text-muted">{subtitle}</div>
      </div>
      <span className={selected ? 'text-accent' : 'text-line'}>{selected ? '✓' : '○'}</span>
    </button>
  )
}

function Primary({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[54px] w-full items-center justify-center rounded-xl bg-accent font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function Secondary({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="min-h-[46px] w-full text-sm font-medium text-muted hover:text-ink">
      {children}
    </button>
  )
}
