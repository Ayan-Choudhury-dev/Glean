-- ─────────────────────────────────────────────────────────────────────────────
-- Glean – Dev/Test Seed
-- Run in: Supabase Dashboard → SQL Editor → New Query
--
-- Creates:
--   User:     dev@glean.app / password: glean1234
--   House:    "Dev House"   (invite code: DEVDEV)
--   Inventory: same items as DEV_INVENTORY in useGleanStore.ts
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id  UUID := gen_random_uuid();
  v_house_id UUID := gen_random_uuid();
BEGIN

  -- ── 1. Auth user ────────────────────────────────────────────────────────────
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, role, aud, created_at, updated_at
  ) VALUES (
    v_user_id,
    '00000000-0000-0000-0000-000000000000',
    'dev@glean.app',
    crypt('glean1234', gen_salt('bf', 10)),
    now(),
    '{"name":"Dev User"}'::jsonb,
    'authenticated', 'authenticated',
    now(), now()
  )
  ON CONFLICT (id) DO NOTHING;

  -- GoTrue requires these token columns to be '' not NULL
  UPDATE auth.users SET
    confirmation_token         = '',
    recovery_token             = '',
    email_change_token_new     = '',
    email_change               = '',
    phone_change               = '',
    phone_change_token         = '',
    email_change_token_current = '',
    reauthentication_token     = ''
  WHERE id = v_user_id;

  -- ── 1b. Auth identity (required for email/password login) ───────────────────
  -- Raw SQL inserts bypass Supabase's auth API, so we must insert the identity
  -- record manually. Without it, signInWithPassword always returns 400.
  INSERT INTO auth.identities (
    id, user_id, provider_id, provider, identity_data,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id,
    'dev@glean.app',
    'email',
    jsonb_build_object(
      'sub',            v_user_id::text,
      'email',          'dev@glean.app',
      'email_verified', true,
      'provider',       'email'
    ),
    NULL,
    now(), now()
  );

  -- ── 2. House ────────────────────────────────────────────────────────────────
  INSERT INTO houses (id, name, invite_code)
  VALUES (v_house_id, 'Dev House', 'DEVDEV');

  -- ── 3. Profile (trigger creates it; we just set house_id) ───────────────────
  UPDATE profiles SET house_id = v_house_id WHERE id = v_user_id;

  -- ── 4. Inventory ────────────────────────────────────────────────────────────
  INSERT INTO inventory (house_id, name, qty, category, location) VALUES
    (v_house_id, 'Whole Milk',     2, 'Dairy',       'Fridge'),
    (v_house_id, 'Cheddar Cheese', 1, 'Dairy',       'Fridge'),
    (v_house_id, 'Basmati Rice',   3, 'Grains',      'Pantry'),
    (v_house_id, 'Atta',           1, 'Grains',      'Pantry'),
    (v_house_id, 'Cumin Seeds',    1, 'Spices',      'Cupboard'),
    (v_house_id, 'Turmeric Powder',2, 'Spices',      'Cupboard'),
    (v_house_id, 'Garam Masala',   1, 'Spices',      'Cupboard'),
    (v_house_id, 'Tomatoes',       5, 'Vegetables',  'Fridge'),
    (v_house_id, 'Spinach',        1, 'Vegetables',  'Fridge'),
    (v_house_id, 'Onions',         4, 'Vegetables',  'Counter'),
    (v_house_id, 'Bananas',        6, 'Fruits',      'Counter'),
    (v_house_id, 'Apples',         4, 'Fruits',      'Fridge'),
    (v_house_id, 'Chicken Breast', 2, 'Meat & Fish', 'Freezer'),
    (v_house_id, 'Salmon Fillet',  1, 'Meat & Fish', 'Freezer'),
    (v_house_id, 'Orange Juice',   3, 'Beverages',   'Fridge'),
    (v_house_id, 'Green Tea',      1, 'Beverages',   'Cupboard'),
    (v_house_id, 'Biscuits',       2, 'Snacks',      'Cupboard'),
    (v_house_id, 'Mixed Nuts',     1, 'Snacks',      'Cupboard');

  -- ── 5. Some consumption logs (for Recent Activity testing) ──────────────────
  INSERT INTO consumption_logs (house_id, inventory_id, item_name, qty, action, consumed_at)
  SELECT
    v_house_id,
    id,
    name,
    1,
    'used',
    now() - interval '2 hours'
  FROM inventory WHERE house_id = v_house_id AND name = 'Orange Juice';

  INSERT INTO consumption_logs (house_id, inventory_id, item_name, qty, action, consumed_at)
  SELECT
    v_house_id,
    id,
    name,
    2,
    'used',
    now() - interval '1 day'
  FROM inventory WHERE house_id = v_house_id AND name = 'Orange Juice';

  INSERT INTO consumption_logs (house_id, inventory_id, item_name, qty, action, consumed_at)
  SELECT
    v_house_id,
    id,
    name,
    1,
    'used',
    now() - interval '3 days'
  FROM inventory WHERE house_id = v_house_id AND name = 'Whole Milk';

END $$;
