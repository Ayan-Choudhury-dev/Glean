-- ─────────────────────────────────────────────────────────────────────────────
-- Glean – Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ─────────────────────────────────────────────────────────────────────────────

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS houses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Extends auth.users (auto-created by Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  house_id UUID REFERENCES houses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS inventory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id        UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  qty             INTEGER NOT NULL DEFAULT 0,
  category        TEXT NOT NULL DEFAULT 'Other',
  location        TEXT,
  image_url       TEXT,
  last_restocked  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shopping_list (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id     UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES inventory(id) ON DELETE SET NULL,
  name         TEXT NOT NULL,
  target_qty   INTEGER NOT NULL DEFAULT 1,
  status       TEXT NOT NULL DEFAULT 'to_buy'
                 CHECK (status IN ('to_buy', 'purchased')),
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consumption_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id     UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
  item_name    TEXT NOT NULL,
  qty          INTEGER NOT NULL,
  action       TEXT NOT NULL DEFAULT 'used'
                 CHECK (action IN ('used', 'restocked', 'added')),
  consumed_at  TIMESTAMPTZ DEFAULT now()
);


-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE houses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list   ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumption_logs ENABLE ROW LEVEL SECURITY;

-- Helper: get the caller's house_id from their profile
CREATE OR REPLACE FUNCTION my_house_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT house_id FROM profiles WHERE id = auth.uid()
$$;

-- profiles: own row only
CREATE POLICY "profiles: own row" ON profiles
  FOR ALL USING (id = auth.uid());

-- houses: member access
CREATE POLICY "houses: members only" ON houses
  FOR ALL USING (id = my_house_id());

-- inventory: house members only
CREATE POLICY "inventory: house members" ON inventory
  FOR ALL USING (house_id = my_house_id());

-- shopping_list: house members only
CREATE POLICY "shopping_list: house members" ON shopping_list
  FOR ALL USING (house_id = my_house_id());

-- consumption_logs: house members only
CREATE POLICY "consumption_logs: house members" ON consumption_logs
  FOR ALL USING (house_id = my_house_id());


-- ── Auto-create profile on sign-up ───────────────────────────────────────────
-- (name will be updated by the app immediately after sign-up)

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'New user'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
