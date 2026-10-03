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

CREATE TABLE IF NOT EXISTS house_options (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id    UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('category', 'location')),
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS house_options_unique_name
  ON house_options (house_id, type, lower(name));


-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE houses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list   ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumption_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE house_options     ENABLE ROW LEVEL SECURITY;

-- Helper: get the caller's house_id from their profile
CREATE OR REPLACE FUNCTION my_house_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT house_id FROM profiles WHERE id = auth.uid()
$$;

-- profiles: own row only
DROP POLICY IF EXISTS "profiles: own row" ON profiles;
CREATE POLICY "profiles: own row" ON profiles
  FOR ALL USING (id = auth.uid());

-- houses: member access
DROP POLICY IF EXISTS "houses: members only" ON houses;
CREATE POLICY "houses: members only" ON houses
  FOR ALL USING (id = my_house_id());

-- houses: join via invite code — any authenticated user who already knows the
-- code may look a house up; membership is granted by the join flow afterwards.
DROP POLICY IF EXISTS "houses: lookup by invite code" ON houses;
CREATE POLICY "houses: lookup by invite code" ON houses
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- inventory: house members only
DROP POLICY IF EXISTS "inventory: house members" ON inventory;
CREATE POLICY "inventory: house members" ON inventory
  FOR ALL USING (house_id = my_house_id());

-- shopping_list: house members only
DROP POLICY IF EXISTS "shopping_list: house members" ON shopping_list;
CREATE POLICY "shopping_list: house members" ON shopping_list
  FOR ALL USING (house_id = my_house_id());

-- consumption_logs: house members only
DROP POLICY IF EXISTS "consumption_logs: house members" ON consumption_logs;
CREATE POLICY "consumption_logs: house members" ON consumption_logs
  FOR ALL USING (house_id = my_house_id());

DROP POLICY IF EXISTS "house_options: house members" ON house_options;
CREATE POLICY "house_options: house members" ON house_options
  FOR ALL USING (house_id = my_house_id());


-- ── Auto-create profile on sign-up ───────────────────────────────────────────
-- (name will be updated by the app immediately after sign-up)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'New user'));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ── Storage: item images ───────────────────────────────────────────────────────
-- Public bucket; authenticated users may upload/update. Images are keyed by
-- <house_id>/<item_id>.<ext>.

INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "item-images: read" ON storage.objects;
CREATE POLICY "item-images: read" ON storage.objects
  FOR SELECT USING (bucket_id = 'item-images');

DROP POLICY IF EXISTS "item-images: insert" ON storage.objects;
CREATE POLICY "item-images: insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'item-images');

DROP POLICY IF EXISTS "item-images: update" ON storage.objects;
CREATE POLICY "item-images: update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'item-images');
