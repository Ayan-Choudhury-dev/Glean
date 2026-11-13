# Migrating the self-hosted backend to PocketBase

A plan, not a decision. Today the backend is Postgres + PostgREST + nginx in
three containers, with RLS off and a shared token in front. PocketBase would
collapse that to one container, add realtime and real accounts, and make backups
a directory copy.

The reason to do it: realtime. The reason not to: the id remap, and a login step
in a flow that is currently account-free.

## What moves

| Today | PocketBase |
|---|---|
| 3 containers | 1 (`ghcr.io/muchobien/pocketbase`) |
| `db_data` volume | `pb_data/` directory |
| `sb.from('inventory').upsert()` | `pb.collection('inventory').upsert()` |
| refresh on foreground | `pb.collection('inventory').subscribe('*')` |
| nginx token gate | collection rules + auth |
| no admin | `/_/` admin UI, built-in backups |
| `scripts/backend-backup.sh` | copy `pb_data/`, or the admin UI export |

Six collections: `houses`, `inventory`, `shopping_list`, `consumption_logs`,
`house_options`, `pairing_codes`.

## The one hard problem: ids

Our rows key on UUIDs (`crypto.randomUUID()`), local SQLite included. PocketBase
record ids are 15-character alphanumerics and cannot be UUIDs.

Two options:

1. **`uid` text field on every collection** (recommended). PocketBase keeps its
   own `id`; our uuid lives in `uid`, every filter becomes
   `filter: uid = "<uuid>"`, and local SQLite is untouched. Costs a mapping
   helper and a unique index per collection.
2. **Adopt PocketBase ids.** Rewrite every local row's id on first sync. Cheaper
   in code, but it means migrating the phone's SQLite and every existing row in
   the shopping list and consumption log that references an inventory id.

Option 1 is the only one that does not touch user data on the device.

## Phases

### Phase 0 — the token gate (done, independent of this)

nginx compares `GLEAN_TOKEN`; the app sends it as the key. This closes the open
API without waiting for a migration, and it is the security floor either way.

### Phase 1 — schema and rules (no app changes)

- Six collections, with `uid` unique, and the same fields as
  `backend/init/01-schema.sql`.
- One `users` auth collection for the household. Rules:
  - `houses`: list/view for authenticated; create for authenticated.
  - `inventory`, `shopping_list`, `consumption_logs`, `house_options`: full
    access only where `house_id` matches the caller's `house_id` field.
  - `pairing_codes`: create for authenticated, list/view for anyone who knows
    the code (that is the point), delete on redeem.
- Verify with `curl` that an unauthenticated request gets `403`, not data.

### Phase 2 — the app's sync layer

- `lib/supabase.ts` → `lib/pocketbase.ts`: client, `authWithPassword`, a
  `testConnection` that distinguishes *unreachable* from *rejected*.
- `lib/sync.ts`: the five functions keep their signatures. `pushHouse` becomes
  upserts filtered on `uid`; `pullHouse` becomes five list calls; pairing keeps
  its shape.
- Realtime replaces the foreground refresh in `app/_layout.tsx`: subscribe on
  connect, unsubscribe on background, apply deltas into the store.
- `app/server.tsx`: connect gains a login step (email + password on *their*
  server), and the "Create a code" path stays.

### Phase 3 — data migration

`scripts/migrate-to-pocketbase.mjs`:

1. `pg_dump --data-only --inserts` (or read the API) into rows.
2. Create the admin user, then the six collections.
3. POST each row with its `uid` preserved.
4. Compare counts per collection; abort on mismatch.

Run it against a copy of the volume, never the live one.

### Phase 4 — cutover

- Ship the app version that speaks both: try PocketBase, fall back to the old
  REST shape while the user has not reconnected. One release, two backends.
- Publish the PocketBase compose file as `backend/docker-compose.pocketbase.yml`
  and keep the old one for a release cycle.
- Docs: rewrite `SELF_HOSTING.md`, `API.md`, `ARCHITECTURE.md`; keep a
  "still on Postgres?" section for a cycle.

### Phase 5 — remove

Delete the Postgres/PostgREST compose, `Dockerfile.db`, `Dockerfile.web`,
`nginx.conf.template`, the token gate, and `scripts/backend-backup.sh` in favour
of a `pb_data` copy.

## Rollback

Before Phase 5 the old stack still runs: keep `db_data` and the last `pg_dump`.
After Phase 5, rollback means restoring that dump into a fresh Postgres — so do
not delete it until a release has shipped and worked.

## Cost

```
lib/supabase.ts    rewrite          ~60 lines
lib/sync.ts        rewrite         ~180 lines
app/server.tsx     connect + login   moderate
app/_layout.tsx    realtime wiring   small
backend/           one compose file, delete nginx + 2 Dockerfiles
scripts/           migrate script   ~120 lines
docs/              3 rewrites
```

Roughly 600 lines touched, 250 new, one to two focused days, plus a release that
speaks both protocols.

## What it does not buy

- Conflict resolution. PocketBase is still last-write-wins per record; a
  per-row `updated` comparison would have to be written either way.
- Offline behaviour. The phone already works offline; nothing here changes that.
- Fewer moving parts on the phone. All of this is server-side.
