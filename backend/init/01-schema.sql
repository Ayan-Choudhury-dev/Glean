-- Glean — self-hosted (single-tenant) schema.
--
-- Applied automatically on the backend's first boot. No Supabase Auth: rows are
-- keyed by the app's local UUIDs and RLS is disabled, so the app syncs with only
-- the anon key (the "simple self-hosted" model).
--
-- SECURITY: anyone who can reach the API has full read/write. Keep it on a
-- trusted network (LAN/VPN) or put real auth in front before exposing it.

create extension if not exists "pgcrypto";

create table if not exists houses (
  id          text primary key,
  name        text not null,
  invite_code text,
  owner_id    text,
  image_key   text,
  created_at  timestamptz default now()
);

create table if not exists profiles (
  id         text primary key,
  name       text not null,
  house_id   text,
  avatar_url text
);

create table if not exists inventory (
  id             text primary key,
  house_id       text not null,
  name           text not null,
  qty            integer not null default 0,
  category       text not null default 'Other',
  location       text,
  image_url      text,
  barcode        text,
  last_restocked timestamptz,
  created_at     timestamptz default now()
);

create table if not exists shopping_list (
  id           text primary key,
  house_id     text not null,
  inventory_id text,
  name         text not null,
  target_qty   integer not null default 1,
  status       text not null default 'to_buy',
  created_at   timestamptz default now()
);

create table if not exists consumption_logs (
  id           text primary key,
  house_id     text not null,
  inventory_id text,
  item_name    text not null,
  qty          integer not null default 1,
  action       text not null default 'used',
  user_id      text,
  consumed_at  timestamptz default now()
);

create table if not exists house_options (
  id         text primary key,
  house_id   text not null,
  type       text not null,
  name       text not null,
  icon       text,
  created_by text,
  created_at timestamptz default now()
);

create index if not exists inventory_house_id_idx        on inventory (house_id);
create index if not exists shopping_list_house_id_idx    on shopping_list (house_id);
create index if not exists consumption_logs_house_id_idx on consumption_logs (house_id);
create index if not exists house_options_house_id_idx    on house_options (house_id);

-- Single-tenant: the anon role has full access.
alter table houses           disable row level security;
alter table profiles         disable row level security;
alter table inventory        disable row level security;
alter table shopping_list    disable row level security;
alter table consumption_logs disable row level security;
alter table house_options    disable row level security;
