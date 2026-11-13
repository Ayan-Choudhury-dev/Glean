# Glean API

The optional backend exposes the pantry tables over PostgREST. This document
covers the surface the app actually uses. Nothing else exists: no auth service,
no storage API, no realtime socket, no RPC functions.

## Base URL

```
http://<host>:8000/rest/v1
```

nginx listens on `${PORT:-8000}` (port 80 in the container) and rewrites
`/rest/v1/*` to PostgREST's root, which is the URL shape the Supabase JS client
expects. PostgREST listens on `:3000` inside the Docker network and is not
published. `GET /rest/v1` redirects with `308` to `/rest/v1/`. The bare host
(`http://<host>:8000/`) serves a static read-only dashboard, not the API.

## Headers

The bundled backend has no JWT secret, so **no request is authenticated**. The app
sends the headers the Supabase JS client always sends, and PostgREST ignores their
contents:

```
apikey: <anon key>
Authorization: Bearer <anon key>
Content-Type: application/json
```

The address comes from **Settings → Add member**. The bundled server accepts
any non-empty key — it is not validated — so the app fills in `glean` and hides
the field under Advanced.
`lib/serverConfig.ts` stores URL and key in the local SQLite `meta` table, and
`lib/supabase.ts` builds the client from them at startup. No config means no
client and no network calls.

Per-request headers: `Prefer: resolution=merge-duplicates` on upsert (added by
`.upsert()`), and `Accept: application/vnd.pgrst.object+json` on `.maybeSingle()`.

## Tables

From `backend/init/01-schema.sql`. Ids are client-generated UUIDs in `text`
columns; timestamps are `timestamptz` defaulting to `now()`.

**`houses`** — `id` text PK · `name` text not null · `invite_code` text (unused by
the solo build) · `owner_id` text · `image_key` text (local file key) ·
`created_at` timestamptz.

**`profiles`** — `id` text PK · `name` text not null · `house_id` text ·
`avatar_url` text. The app keeps the profile on-device; `pushHouse` never writes
this table. It exists so a future multi-device restore has somewhere to put one.

**`inventory`** — `id` text PK · `house_id` text not null (indexed) · `name` text
not null · `qty` integer not null default 0 · `category` text not null default
`'Other'` · `location` text · `image_url` text (local file URI in practice) ·
`barcode` text · `last_restocked` timestamptz · `created_at` timestamptz.

**`shopping_list`** — `id` text PK · `house_id` text not null (indexed) ·
`inventory_id` text (nullable link to `inventory.id`) · `name` text not null ·
`target_qty` integer not null default 1 · `status` text not null default
`'to_buy'` (`to_buy` or `purchased`) · `created_at` timestamptz.

**`consumption_logs`** — `id` text PK · `house_id` text not null (indexed) ·
`inventory_id` text · `item_name` text not null (denormalized, so logs survive
item deletion) · `qty` integer not null default 1 · `action` text not null default
`'used'` (`used`, `restocked`, `added`) · `user_id` text (nullable) ·
`consumed_at` timestamptz.

**`house_options`** — `id` text PK · `house_id` text not null (indexed) · `type`
text not null (`category` or `location`) · `name` text not null · `icon` text
(Ionicons name) · `created_by` text · `created_at` timestamptz.

Indexes: `inventory_house_id_idx`, `shopping_list_house_id_idx`,
`consumption_logs_house_id_idx`, `house_options_house_id_idx`.

## Query patterns

Four call shapes, all from `lib/sync.ts`.

Read one house:

```
GET /rest/v1/houses?select=*&id=eq.<house_id>
Accept: application/vnd.pgrst.object+json
```

```
GET /rest/v1/inventory?select=*&house_id=eq.<house_id>
GET /rest/v1/shopping_list?select=*&house_id=eq.<house_id>
GET /rest/v1/consumption_logs?select=*&house_id=eq.<house_id>&order=consumed_at.desc
GET /rest/v1/house_options?select=*&house_id=eq.<house_id>
```

Read the first house id, used to adopt an existing house on a fresh install:

```
GET /rest/v1/houses?select=id&limit=1
```

Upsert rows by primary key — this is the whole push path:

```
POST /rest/v1/inventory
Prefer: resolution=merge-duplicates
Content-Type: application/json

[{ "id": "...", "house_id": "...", "name": "Milk", "qty": 2, "category": "Dairy" }]
```

`pushHouse` upserts `houses` first, then each child table, always with
`onConflict: 'id'` and a body holding the full local snapshot for that table.
Empty tables are skipped. Deletes are never sent: there is no `DELETE` in the sync
code and no soft-delete column, so a row removed on one device survives on the
server and reappears on the next pull.

## Errors

PostgREST returns standard status codes with a JSON body carrying `code`,
`message`, `details`, `hint`. The app does not branch on these; a failed push is
reported through the store's `syncError` banner. A wrong URL or empty key fails
earlier in `testConnection()`, which probes
`GET /rest/v1/profiles?select=id&limit=1` and surfaces `error.message`.

## Security warning

**This API is unauthenticated and fully writable.** RLS is disabled on every table
and the anon role has read and write access. Anyone who can reach the port can
list every house, overwrite any row, and insert anything. There is no rate
limiting, no audit trail, and no per-user scoping — `house_id` is a filter the
client chooses, not an access-control boundary.

Run it only on a trusted LAN or VPN. Before exposing it to the internet, put TLS
and real authentication in front of it (an authenticating reverse proxy, or a
Tailscale/Cloudflare Tunnel with an access policy). Treat the anon key as public
information: it grants nothing and protects nothing.

## Limits

- Single tenant: one household per deployment is the intended use.
- No pagination handling; pulls fetch all rows for a house.
- No realtime; changes reach other devices on the next push or pull.
- No migrations beyond the init script, which runs only on an empty data volume.
