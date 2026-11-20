# Glean

A local-first pantry and shopping list app built with Expo and React Native.
Track what's in your kitchen, know what's running low, and build a shopping
list — all stored on your device. No account, no server, no tracking.

## Features

- **Pantry Inventory** — items, quantities, categories, storage locations, inline quantity steppers
- **Shopping List** — To Buy / Purchased segments, per-item quantities, one-tap "Update Pantry"
- **Consumption Tracking** — usage history per item
- **Import / Export** — CSV import and export
- **Works offline** — everything lives in a local SQLite database

## Tech Stack

- [Expo](https://expo.dev) SDK 58 (Expo Router)
- [React Native](https://reactnative.dev) 0.88
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) — local storage
- [Zustand](https://zustand-demo.pmnd.rs) — state management
- [NativeWind](https://www.nativewind.dev) + Tailwind CSS — styling
- Optional self-hosted backend: PocketBase in Docker (one container)

## Download

Grab the APK from the [latest release](https://github.com/Ayan-Choudhury-dev/Glean/releases/latest).

| Your phone | File |
|---|---|
| Most phones from ~2017 onward | `glean-<version>-arm64-v8a.apk` — smallest download |
| Older 32-bit phones | `glean-<version>-armeabi-v7a.apk` — widest compatibility |

If you're not sure, try the `arm64-v8a` build first. If Android says
"App not installed", use the `armeabi-v7a` one.

## Install

### Prerequisites

**Client (Android):**
- Node.js **22 or 24 LTS** (SDK 58 does not support Node 23)
- JDK 17
- Android SDK (Android Studio) and a connected device/emulator

**Backend (optional):**
- Docker + Docker Compose

### 1. Clone + install

```bash
git clone https://github.com/Ayan-Choudhury-dev/Glean.git
cd Glean
npm install
```

### 2. Build the client

The app uses native modules, so it needs a development build (not Expo Go):

```bash
npx expo run:android        # or: make android
```

This builds the APK, installs it on the connected device, and starts Metro.

### 3. Run the backend (optional)

```bash
cd backend/pocketbase
cp .env.example .env
docker compose up -d          # http://<host>:8090
```

Open `http://<host>:8090/_/`, create the superuser, then create the collections
and a household account:

```bash
PB_URL=http://<host>:8090 PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=... \
  node scripts/pocketbase-bootstrap.mjs
```

See [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) for TLS, backups and
Tailscale. Then in the app: **Settings → Add member → the address → your
account**.

The older Postgres + PostgREST bundle in `backend/` still works and is
documented in the same guide, but new installs should use PocketBase.

### Checks

```bash
npm run typecheck   # or: make typecheck
npm test            # or: make test
```

## Project Structure

```
app/
  (tabs)/            # Pantry, Shopping list, Profile
  onboarding.tsx     # First-run name setup
  house-setup.tsx    # Create your pantry
  item-form.tsx      # Add / edit inventory item
store/
  useGleanStore.ts   # Zustand store (profile, pantry, shopping list, logs)
lib/
  db/                # SQLite schema + local client
  sync.ts            # push/pull, routed to whichever backend is configured
  pocketbase.ts      # PocketBase client: auth, push/pull, realtime
  predictions.ts     # Restock prediction logic
components/
  NativeSheet.tsx    # JS bottom sheet
  ui/                # Thin NativeWind primitives
backend/             # Self-hosted backends (optional): pocketbase/ + legacy Postgres
metadata/
  *.yml              # F-Droid listing metadata
Makefile             # Developer shortcuts (make install / android / backend-up)
```

## Self-hosting (optional)

Glean is local-first and needs no server. To sync across devices, run the
bundled PocketBase on any Docker host — see
[Install → step 3](#3-run-the-backend-optional) and
[`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md).

## Data & Privacy

All data is stored locally in a SQLite database on your device. Nothing is
sent to a server, and there is no account or sign-in. Uninstalling the app
removes the data.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the app, local DB and sync fit together
- [`DESIGN.md`](DESIGN.md) — design tokens and screen rules
- [`docs/MOBILE.md`](docs/MOBILE.md) — dev builds, running on a phone, troubleshooting
- [`docs/APP_STORES.md`](docs/APP_STORES.md) — Play, F-Droid and direct APK status
- [`docs/API.md`](docs/API.md) — the PostgREST surface of the optional backend
- [`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) — running your own server
- [`docs/DATA_IMPORTS.md`](docs/DATA_IMPORTS.md) — CSV import/export format
- [`docs/FAQ.md`](docs/FAQ.md) — common questions
- [`docs/LAUNCH.md`](docs/LAUNCH.md) — what is ready and what is not

## Roadmap

Planned and deferred work lives in [`ROADMAP.md`](ROADMAP.md).

## License

Licensed under the Apache License, Version 2.0 — see [LICENSE](LICENSE) and
[NOTICE](NOTICE).
