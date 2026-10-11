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
  image_key   TEXT,
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
  barcode         TEXT,
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
  user_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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

-- houses: members may read; only the owner may rename or delete.
-- No INSERT policy: house creation goes through the create_house() RPC
-- (SECURITY DEFINER, bypasses RLS) so a client cannot insert an orphan house.
DROP POLICY IF EXISTS "houses: members only" ON houses;
DROP POLICY IF EXISTS "houses: select members" ON houses;
CREATE POLICY "houses: select members" ON houses
  FOR SELECT USING (id = my_house_id());

DROP POLICY IF EXISTS "houses: update owner" ON houses;
CREATE POLICY "houses: update owner" ON houses
  FOR UPDATE TO authenticated
  USING (id = my_house_id() AND owner_id = auth.uid())
  WITH CHECK (id = my_house_id() AND owner_id = auth.uid());

DROP POLICY IF EXISTS "houses: delete owner" ON houses;
CREATE POLICY "houses: delete owner" ON houses
  FOR DELETE TO authenticated
  USING (id = my_house_id() AND owner_id = auth.uid());

-- houses: no broad SELECT policy. Joining is done via the join_house() RPC
-- (SECURITY DEFINER) so the client can never enumerate houses or invite codes.
-- INSERT is granted by the "houses: create" policy below.

-- profiles: block direct house_id tampering (RLS cannot constrain a column).
CREATE OR REPLACE FUNCTION public.protect_profile_house_id()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.house_id IS NOT NULL
     AND NEW.house_id IS DISTINCT FROM OLD.house_id
     AND coalesce(current_setting('app.house_change', true), '') <> 'allowed' THEN
    RAISE EXCEPTION 'house_id can only be changed via join_house() or leave_house()';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_house_id ON profiles;
CREATE TRIGGER profiles_protect_house_id
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_house_id();

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

-- Avatars (separate bucket; keyed by <user_id>.<ext>)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "avatars: read" ON storage.objects;
CREATE POLICY "avatars: read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars: insert" ON storage.objects;
CREATE POLICY "avatars: insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars: update" ON storage.objects;
CREATE POLICY "avatars: update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'avatars');


-- ── Realtime ───────────────────────────────────────────────────────────────────
-- Publish household tables so members see each other's changes live.

ALTER PUBLICATION supabase_realtime ADD TABLE inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE shopping_list;
ALTER PUBLICATION supabase_realtime ADD TABLE consumption_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE house_options;

-- Add avatar support to profiles.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;


-- ── Household ownership & membership ──────────────────────────────────────────
-- Owner may rename the house and remove members; everyone may leave.

ALTER TABLE houses ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE houses ADD COLUMN IF NOT EXISTS image_key TEXT;
ALTER TABLE consumption_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS consumption_logs_user_id_idx ON consumption_logs (user_id);

-- Backfill: earliest member becomes owner where unset.
UPDATE houses h
SET owner_id = (
  SELECT p.id FROM profiles p
  WHERE p.house_id = h.id
  ORDER BY p.id
  LIMIT 1
)
WHERE h.owner_id IS NULL;

-- Leave the current house. Promotes the next member when the owner leaves, and
-- deletes the house outright once the last member is gone (an orphan is
-- unreachable and its invite code would otherwise stay valid forever).
CREATE OR REPLACE FUNCTION public.leave_house()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me UUID := auth.uid();
  h  UUID := my_house_id();
  next_owner UUID;
BEGIN
  IF me IS NULL OR h IS NULL THEN RETURN; END IF;

  PERFORM set_config('app.house_change', 'allowed', true);
  UPDATE profiles SET house_id = NULL WHERE id = me;

  IF EXISTS (SELECT 1 FROM houses WHERE id = h AND owner_id = me) THEN
    SELECT id INTO next_owner FROM profiles WHERE house_id = h ORDER BY id LIMIT 1;
    IF next_owner IS NOT NULL THEN
      UPDATE houses SET owner_id = next_owner WHERE id = h;
    END IF;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE house_id = h) THEN
    DELETE FROM houses WHERE id = h;
  END IF;
END;
$$;

-- Remove another member. Owner only. Needed because RLS allows only own-row updates.
CREATE OR REPLACE FUNCTION public.remove_member(target UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me UUID := auth.uid();
  h  UUID := my_house_id();
BEGIN
  IF me IS NULL OR h IS NULL THEN RAISE EXCEPTION 'not a member'; END IF;
  IF NOT EXISTS (SELECT 1 FROM houses WHERE id = h AND owner_id = me) THEN
    RAISE EXCEPTION 'only the owner can remove members';
  END IF;
  IF target = me THEN RAISE EXCEPTION 'use leave_house to remove yourself'; END IF;

  PERFORM set_config('app.house_change', 'allowed', true);
  UPDATE profiles SET house_id = NULL WHERE id = target AND house_id = h;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_house() TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(UUID) TO authenticated;

-- Live membership/ownership changes.
ALTER PUBLICATION supabase_realtime ADD TABLE houses;


-- ── RLS fixes: house creation + member visibility ─────────────────────────────

-- Bypass RLS inside the helper so it can safely be referenced from a profiles
-- policy (otherwise Postgres raises "infinite recursion detected in policy").
CREATE OR REPLACE FUNCTION public.my_house_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT house_id FROM profiles WHERE id = auth.uid()
$$;

-- House creation moved to the create_house() RPC below (SECURITY DEFINER), so the
-- old `houses: create` INSERT policy is gone — clients can no longer insert a
-- house directly and leave an orphan row.
DROP POLICY IF EXISTS "houses: create" ON houses;

-- House members can read each other's profiles (members list, avatars, names).
DROP POLICY IF EXISTS "profiles: house members read" ON profiles;
CREATE POLICY "profiles: house members read" ON profiles
  FOR SELECT USING (house_id = my_house_id() OR id = auth.uid());

-- Join a house by invite code. SECURITY DEFINER so the lookup does not depend on
-- the caller's RLS visibility; returns the house id, or NULL when the code is unknown.
CREATE OR REPLACE FUNCTION public.join_house(invite TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me UUID := auth.uid();
  h  UUID;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF EXISTS (SELECT 1 FROM profiles WHERE id = me AND house_id IS NOT NULL) THEN
    RAISE EXCEPTION 'already in a house; leave before joining another';
  END IF;
  SELECT id INTO h FROM houses WHERE invite_code = upper(trim(invite));
  IF h IS NULL THEN RETURN NULL; END IF;
  PERFORM set_config('app.house_change', 'allowed', true);
  UPDATE profiles SET house_id = h WHERE id = me;
  RETURN h;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_house(TEXT) TO authenticated;

-- Create a house atomically (house row + profile link), with a cryptographically
-- random invite code. Replaces the old 3-call client sequence.
CREATE OR REPLACE FUNCTION public.create_house(p_name TEXT)
RETURNS TABLE (house_id UUID, invite_code TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  me   UUID := auth.uid();
  hid  UUID := gen_random_uuid();
  code TEXT;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) = 0 THEN RAISE EXCEPTION 'house name required'; END IF;
  IF EXISTS (SELECT 1 FROM profiles p WHERE p.id = me AND p.house_id IS NOT NULL) THEN
    RAISE EXCEPTION 'already in a house';
  END IF;

  LOOP
    -- 6 hex chars from a v4 UUID (OS entropy), retried on the rare collision.
    code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM houses h WHERE h.invite_code = code);
  END LOOP;

  INSERT INTO houses (id, name, invite_code, owner_id)
  VALUES (hid, trim(p_name), code, me);

  PERFORM set_config('app.house_change', 'allowed', true);
  UPDATE profiles p SET house_id = hid WHERE p.id = me;

  RETURN QUERY SELECT hid, code;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_house(TEXT) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.create_house(TEXT) TO authenticated;

-- Atomic restock: bumps qty server-side (so two phones restocking the same item
-- cannot lose an update) and writes the attributed consumption log in the same
-- transaction. Returns the new quantity.
CREATE OR REPLACE FUNCTION public.restock_inventory(p_id UUID, p_qty INT)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  h      UUID := my_house_id();
  me     UUID := auth.uid();
  v_name TEXT;
  v_qty  INTEGER;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'qty must be positive'; END IF;

  SELECT name INTO v_name FROM inventory WHERE id = p_id AND house_id = h;
  IF v_name IS NULL THEN RAISE EXCEPTION 'item not found in your house'; END IF;

  UPDATE inventory
     SET qty = qty + p_qty, last_restocked = now()
   WHERE id = p_id AND house_id = h
  RETURNING qty INTO v_qty;

  INSERT INTO consumption_logs (house_id, inventory_id, item_name, qty, action, user_id)
  VALUES (h, p_id, v_name, p_qty, 'restocked', me);

  RETURN v_qty;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restock_inventory(UUID, INT) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.restock_inventory(UUID, INT) TO authenticated;

-- Only signed-in users may reach the membership RPCs (Postgres grants PUBLIC by default).
REVOKE EXECUTE ON FUNCTION public.join_house(TEXT)   FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.leave_house()      FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.remove_member(UUID) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.my_house_id()      FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()  FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.my_house_id()      TO authenticated;


-- ── Indexes ───────────────────────────────────────────────────────────────────
-- house_id is the filter on every query and on the realtime subscription.

CREATE INDEX IF NOT EXISTS inventory_house_id_idx        ON inventory (house_id);
CREATE INDEX IF NOT EXISTS shopping_list_house_id_idx    ON shopping_list (house_id);
CREATE INDEX IF NOT EXISTS consumption_logs_house_id_idx ON consumption_logs (house_id);
CREATE INDEX IF NOT EXISTS house_options_house_id_idx    ON house_options (house_id);
CREATE INDEX IF NOT EXISTS profiles_house_id_idx         ON profiles (house_id);
CREATE INDEX IF NOT EXISTS inventory_house_barcode_idx    ON inventory (house_id, barcode);
