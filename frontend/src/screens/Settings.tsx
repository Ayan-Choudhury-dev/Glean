import { useState } from 'react'
import { RotateCcw, Server } from 'lucide-react'
import { useStore } from '../store'

export default function Settings() {
  const { profile, server, setName, setServer, reset } = useStore()
  const [name, setNameDraft] = useState(profile?.name ?? '')
  const [url, setUrl] = useState(server?.url ?? '')
  const [key, setKey] = useState(server?.key ?? '')
  const [saved, setSaved] = useState<string | null>(null)

  const saveName = () => {
    setName(name)
    setSaved('Name updated')
  }

  const saveServer = () => {
    setServer(url.trim() && key.trim() ? { url: url.trim(), key: key.trim() } : null)
    setSaved(url.trim() && key.trim() ? 'Server saved' : 'Server cleared')
  }

  return (
    <div className="mx-auto min-h-full w-full max-w-2xl px-6 pb-6 pt-6">
      <h1 className="font-display text-[32px] font-bold leading-none tracking-[-0.5px] text-ink">Settings</h1>
      <p className="mt-1.5 text-[14px] text-muted">Signed in as {profile?.name}</p>

      <Section title="Profile">
        <label className="text-[12px] font-medium text-muted">Your name</label>
        <div className="mt-1.5 flex gap-2">
          <input
            value={name}
            onChange={(e) => setNameDraft(e.target.value)}
            className="h-12 flex-1 rounded-md border border-line bg-surface-muted px-4 text-[15px] text-ink outline-none focus:border-accent"
          />
          <button onClick={saveName} className="rounded-md bg-accent px-4 text-[14px] font-medium text-white hover:opacity-90">
            Save
          </button>
        </div>
      </Section>

      <Section title="Self-hosted backend">
        <p className="text-[13px] text-muted">Optional. Sync your pantry through a server you run.</p>
        <div className="mt-2 space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://my-server:8000"
            className="h-12 w-full rounded-md border border-line bg-surface-muted px-4 text-[15px] text-ink outline-none placeholder:text-faint focus:border-accent"
          />
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Anon key"
            className="h-12 w-full rounded-md border border-line bg-surface-muted px-4 text-[15px] text-ink outline-none placeholder:text-faint focus:border-accent"
          />
          <button onClick={saveServer} className="h-11 w-full rounded-md bg-accent text-[14px] font-medium text-white hover:opacity-90">
            Save server
          </button>
        </div>
        {server && (
          <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted">
            <Server size={13} /> Connected to {server.url}
          </p>
        )}
      </Section>

      <Section title="Data">
        <button
          onClick={() => {
            if (window.confirm('Reset everything on this device? This cannot be undone.')) reset()
          }}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-md border border-line text-[14px] font-medium text-danger hover:bg-surface-muted"
        >
          <RotateCcw size={16} /> Reset app
        </button>
      </Section>

      {saved && <p className="mt-4 text-center text-[12px] text-muted">{saved}</p>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 text-[12px] font-bold uppercase tracking-[1.2px] text-muted">{title}</h2>
      <div className="rounded-lg border border-line bg-surface p-4">{children}</div>
    </section>
  )
}
