import { useEffect, useState } from 'react'
import { LayoutGrid, ShoppingCart, Settings as SettingsIcon } from 'lucide-react'
import { useStore } from './store'
import Onboarding from './screens/Onboarding'
import Pantry from './screens/Pantry'
import Shopping from './screens/Shopping'
import Settings from './screens/Settings'

type Tab = 'pantry' | 'shopping' | 'settings'

export default function App() {
  const profile = useStore((s) => s.profile)
  const theme = useStore((s) => s.theme)
  const [tab, setTab] = useState<Tab>('pantry')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  if (!profile) {
    return (
      <div className="min-h-dvh">
        <Onboarding />
      </div>
    )
  }

  return (
    <div className="min-h-dvh pb-[calc(64px+env(safe-area-inset-bottom))]">
      {tab === 'pantry' && <Pantry />}
      {tab === 'shopping' && <Shopping />}
      {tab === 'settings' && <Settings />}

      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line-light bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-2xl">
          <TabButton active={tab === 'pantry'} onClick={() => setTab('pantry')} icon={LayoutGrid} label="Pantry" />
          <TabButton active={tab === 'shopping'} onClick={() => setTab('shopping')} icon={ShoppingCart} label="Shopping list" />
          <TabButton active={tab === 'settings'} onClick={() => setTab('settings')} icon={SettingsIcon} label="Settings" />
        </div>
      </nav>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: typeof LayoutGrid
  label: string
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="flex flex-1 flex-col items-center gap-1 py-2 transition-transform active:scale-95"
    >
      <span
        className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
          active ? 'bg-accent-soft' : ''
        }`}
      >
        <Icon size={22} className={active ? 'text-accent' : 'text-muted'} strokeWidth={active ? 2.2 : 1.8} />
      </span>
      <span className={`text-[11px] font-medium ${active ? 'text-accent' : 'text-muted'}`}>{label}</span>
    </button>
  )
}
