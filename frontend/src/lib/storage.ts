import { Capacitor } from '@capacitor/core'

// Native builds persist to a real SQLite database; the web build uses
// localStorage so the app stays usable in a browser. The zustand `persist`
// middleware only sees a key/value store either way.

const isNative = Capacitor.getPlatform() !== 'web'
const DB_NAME = 'glean'

let dbPromise: Promise<unknown> | null = null

async function getDb(): Promise<any> {
  if (!dbPromise) {
    dbPromise = (async () => {
      // Imported lazily so the web bundle never loads the native plugin.
      const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite')
      const sqlite = new SQLiteConnection(CapacitorSQLite)
      const db = await sqlite.createConnection(DB_NAME, false, 'no-encryption', 1, false)
      await db.open()
      await db.execute('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);')
      return db
    })()
  }
  return dbPromise
}

export const storageAdapter = {
  async getItem(key: string): Promise<string | null> {
    if (!isNative) return localStorage.getItem(key)
    const db = await getDb()
    const res = await db.query('SELECT value FROM kv WHERE key = ?', [key])
    return res.values?.[0]?.value ?? null
  },

  async setItem(key: string, value: string): Promise<void> {
    if (!isNative) {
      localStorage.setItem(key, value)
      return
    }
    const db = await getDb()
    await db.run('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value])
  },

  async removeItem(key: string): Promise<void> {
    if (!isNative) {
      localStorage.removeItem(key)
      return
    }
    const db = await getDb()
    await db.run('DELETE FROM kv WHERE key = ?', [key])
  },
}
