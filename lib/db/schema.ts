// Local SQLite schema for Glean. Mirrors the Supabase tables so the app can
// cold-start (and read) entirely on-device; Supabase stays the sync target.

export const SCHEMA_VERSION = 1;

export const DDL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS house (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  invite_code  TEXT,
  owner_id     TEXT,
  image_key    TEXT,
  created_at   TEXT,
  members_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS inventory (
  id             TEXT PRIMARY KEY,
  house_id       TEXT NOT NULL,
  name           TEXT NOT NULL,
  qty            INTEGER NOT NULL DEFAULT 0,
  category       TEXT NOT NULL DEFAULT 'Other',
  location       TEXT,
  image_url      TEXT,
  barcode        TEXT,
  last_restocked TEXT,
  created_at     TEXT
);

CREATE TABLE IF NOT EXISTS shopping_list (
  id           TEXT PRIMARY KEY,
  house_id     TEXT NOT NULL,
  inventory_id TEXT,
  name         TEXT NOT NULL,
  target_qty   INTEGER NOT NULL DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'to_buy',
  created_at   TEXT
);

CREATE TABLE IF NOT EXISTS consumption_logs (
  id           TEXT PRIMARY KEY,
  house_id     TEXT NOT NULL,
  inventory_id TEXT,
  item_name    TEXT NOT NULL,
  consumed_at  TEXT NOT NULL,
  qty          INTEGER NOT NULL DEFAULT 1,
  action       TEXT NOT NULL DEFAULT 'used',
  user_id      TEXT
);

CREATE TABLE IF NOT EXISTS house_options (
  id         TEXT PRIMARY KEY,
  house_id   TEXT NOT NULL,
  type       TEXT NOT NULL,
  name       TEXT NOT NULL,
  icon       TEXT,
  created_by TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS pending_ops (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id     TEXT,
  payload    TEXT
);

CREATE INDEX IF NOT EXISTS idx_inventory_house ON inventory(house_id);
CREATE INDEX IF NOT EXISTS idx_shopping_house  ON shopping_list(house_id);
CREATE INDEX IF NOT EXISTS idx_logs_house      ON consumption_logs(house_id);
CREATE INDEX IF NOT EXISTS idx_options_house   ON house_options(house_id);
`;
