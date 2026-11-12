# Glean architecture

Glean is an Expo app for tracking pantry stock. It works with no account and no
network: every read and write hits a local SQLite file. Syncing to a self-hosted
server is optional and off by default.

## Stack

- Expo SDK 58, React Native 0.88, React 19, TypeScript.
- Expo Router with typed routes: one root `Stack`, one `Tabs` group.
- Zustand for app state (`store/useGleanStore.ts`).
- `expo-sqlite`, database `glean.db`, WAL mode.
- NativeWind 4 + Tailwind 3 for some `className` usage; most styling is inline
  style objects built from tokens in `constants/theme.ts`.
- `lucide-react-native` and `@expo/vector-icons` (Ionicons, FontAwesome) for icons.

## Repo layout

```
app/                 Expo Router routes (screens only, no business logic)
app/(tabs)/          Pantry, Shopping list, Settings
components/          UI primitives (Text, Tappable, OverlayHost) + feature widgets
store/               Zustand store: every mutation lives here
lib/db/              SQLite client and DDL (client.ts, schema.ts)
lib/                 sync.ts, serverConfig.ts, appearance.ts, upload.ts
constants/           theme tokens (theme.ts), feature flags (config.ts)
backend/             Docker bundle: Postgres + PostgREST + nginx dashboard
docs/                this file, API.md, self-hosting notes
```

Screens read from the store and call store actions. Components never touch
SQLite or the network directly.

## Routes

| Route | Purpose |
| --- | --- |
| `onboarding` / `house-setup` | Create the local profile, then name the pantry |
| `(tabs)/index` / `(tabs)/shopping` | Pantry inventory and the shopping list |
| `(tabs)/profile` | Settings: appearance, accent, server, CSV import |
| `item-form` / `scan` / `server` | Item editor, barcode scan, backend config |
| `+html` / `+not-found` | Web document shell, fallback route |

`app/_layout.tsx` holds the splash gate (fonts + restored session), the navigation
theme from `useColors()`, the sync error banner, and the overlay host.
`app/(tabs)/_layout.tsx` redirects to onboarding or house setup as needed.

## Runtime layers

```
 ┌──────────────────────────────┐
 │  Screens (app/*.tsx)         │  render state, dispatch actions
 └──────────────┬───────────────┘
                │ selectors / actions
 ┌──────────────▼───────────────┐
 │  Zustand store               │  in-memory truth for the session
 │  store/useGleanStore.ts      │  debounced write-through subscription
 └──────┬───────────────────┬───┘
        │ localSaveHouse    │ pushHouse (only if a server is configured)
 ┌──────▼──────────┐  ┌─────▼──────────────────┐
 │ glean.db SQLite │  │ PostgREST over HTTP(S) │
 │ WAL, 7 tables   │  │ self-hosted, anon key  │
 └─────────────────┘  └────────────────────────┘
```

No queue and no conflict resolver: the store is the only SQLite writer, `lib/sync.ts`
the only network caller.

## Why local-first

- Usable on first launch with no signup, no email, no server.
- Mutations are synchronous in memory, so steppers and list edits feel instant
  regardless of connectivity.
- The backend is backup plus a read-only dashboard, not a dependency. Clearing
  the server config returns the app to a fully offline state.

The cost: multi-device use is best-effort, with no server-side authority.

## Data model

Local schema (`lib/db/schema.ts`, `SCHEMA_VERSION = 1`):

- `profile` — one row: `id`, `name`, `house_id`, `avatar_url`; `house_id` decides
  whether the app shows onboarding, house setup, or tabs.
- `house` — `id`, `name`, `invite_code`, `owner_id`, `image_key`, `created_at`,
  `members_json` (members are serialized JSON, not a table).
- `inventory` — `id`, `house_id`, `name`, `qty`, `category`, `location`,
  `image_url`, `barcode`, `last_restocked`, `created_at`.
- `shopping_list` — `id`, `house_id`, `inventory_id` (nullable link), `name`,
  `target_qty`, `status` (`to_buy` | `purchased`).
- `consumption_logs` — `id`, `house_id`, `inventory_id`, `item_name`,
  `consumed_at`, `qty`, `action` (`used` | `restocked` | `added`), `user_id`.
- `house_options` — `id`, `house_id`, `type` (`category` | `location`), `name`,
  `icon`, `created_by`. Seeded from `DEFAULT_HOUSE_OPTIONS` on house creation.
- `meta` — key/value scratch space: `last_house_id`, `server_url`,
  `server_anon_key`. `pending_ops` is in the DDL but never written by current code.

Every house-scoped table is indexed on `house_id`. Rows are keyed by
client-generated UUIDs (`crypto.randomUUID` with a fallback), so a row created
offline keeps its identity once it reaches the server.

## Write path

Store actions mutate memory only. A subscription at the bottom of
`store/useGleanStore.ts` watches `house`, `inventory`, `shoppingList`,
`consumptionLogs`, and `houseOptions`; when any reference changes it schedules a
300 ms debounce, then calls `localSaveHouse(houseId, snapshot)` and, if a server
is configured, `pushHouse(houseId)`.

`localSaveHouse` is a full snapshot, not a delta: in one transaction it deletes
all rows for that house across the five tables, reinserts current state, and
rewrites `meta.last_house_id`. Simple and atomic, at the cost of rewriting the
whole house on every flush. `localLoadHouse` refuses to hydrate a house whose id
does not match `meta.last_house_id`, so a stale snapshot cannot appear after a
sign-out or house switch.

## Sync

`lib/sync.ts` has three functions:

- `pushHouse(houseId)` — reads the local snapshot, then upserts `houses` and the
  four child tables with `onConflict: 'id'`. No-op without a client.
- `pullHouse(houseId)` — selects the house plus its child tables (logs ordered by
  `consumed_at` descending) and writes them via `localSaveHouse`.
- `firstServerHouseId()` — adopts an existing server house on a fresh install.

Auth is a shared anon key, not a user session. `lib/supabase.ts` builds the client
from config read out of `meta` at startup, so sync is pure opt-in: no config, no
client, no network calls.

Conflict model: last write wins at row granularity. The store debounces, then
pushes the whole house, so a row edited offline on two devices ends up as
whichever push landed later. Deletions are not propagated at all — the push only
upserts, so a row deleted locally stays on the server and can return on the next
pull.

Known limits, stated plainly:

- No tombstones, no vector clocks, no per-row `updated_at` comparison.
- No pull-on-change and no background sync; pull happens on connect/adopt.
- No retry queue: a failed push surfaces as `syncError` and is otherwise dropped.
- Images are local file URIs (`lib/upload.ts`), so `image_url` does not resolve on
  another device.
- Multi-user households are off (`FEATURES.household = false`); `joinHouse`
  returns false and member management is stubbed.

## Backend topology

`backend/docker-compose.yml` runs three services on one host:

```
        :8000                          internal network
 client ──► nginx ──/rest/v1/──► PostgREST :3000 ──► Postgres :5432
              └── /   (static read-only dashboard)
```

- **db** — Postgres built from `backend/Dockerfile.db`, with
  `backend/init/01-schema.sql` applied on first boot. Schema mirrors the app
  tables with `timestamptz` timestamps.
- **rest** — `postgrest/postgrest:v12.2.3`, `PGRST_DB_SCHEMAS=public`,
  `PGRST_DB_ANON_ROLE=glean`, no JWT secret.
- **proxy** — nginx serving `backend/web/index.html` at `/` and proxying
  `/rest/v1/` to PostgREST, which satisfies the Supabase JS client's URL shape.

Single-tenant by design: RLS is disabled on every table and the anon role has full
access. Anyone who can reach the port can read and write everything, so it must
run on a trusted network or behind an authenticating proxy. See `API.md`. The app
never talks to Postgres directly and never uses Supabase Auth;
`@supabase/supabase-js` is used purely as a PostgREST client.

## Build targets

| Target | Command | Notes |
| --- | --- | --- |
| Android | `npm run android` | `expo run:android`, camera permission for scanning |
| iOS | `npm run ios` | `expo run:ios`, tablets supported |
| Web | `npm run web` | Metro bundler, static output, `app/+html.tsx` shell |

Bundle id is `io.github.ayanchoudhurydev.glean` on both native platforms. Android
also ships as a sideloaded APK from GitHub releases, which is why `lib/updates.ts`
checks for a newer version at startup. Native modules (`expo-sqlite`,
`expo-camera`, `expo-haptics`, `expo-image-picker`) need a dev-client rebuild.

## Design tokens

`constants/theme.ts` is the single source of truth: `palette` (raw hex, including
the Airbnb-derived accent `#FF385C`), `lightColors` / `darkColors` (the same
`AppColors` key set per scheme, text tokens clearing WCAG AA on surface),
`accents` (five presets — `coral`, `emerald`, `blue`, `violet`, `amber` — each with
`accent`, `soft`, `border` plus dark variants), and `radii`, `spacing`, `type`,
`layout`, `fonts` (Geist for UI, Fraunces for display headings), `elevation`, and
a `theme` aggregate.

Components do not read `lightColors` directly. `useColors()` in
`lib/appearance.ts` merges the active scheme with the selected accent and returns
an `AppColors` object; `useC()` is a short alias map for screen-local style
objects. Appearance mode (`system` | `light` | `dark`) and accent persist in
AsyncStorage and are applied via `Appearance.setColorScheme`, so `useColorScheme()`
and NativeWind `dark:` agree. Inline styles from `useColors()` and `theme` are the
default; `className` is the exception.
