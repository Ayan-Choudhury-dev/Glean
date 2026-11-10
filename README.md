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
- Optional self-hosted backend: Postgres + PostgREST in Docker

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
cd backend
cp .env.example .env        # set POSTGRES_PASSWORD
docker compose pull         # prebuilt images from GHCR (or: up -d --build)
docker compose up -d        # or: make backend-up
```

The dashboard + API are at `http://<host>:8000`; the schema applies automatically
on first boot. See [`backend/README.md`](backend/README.md) and
[`docs/SELF_HOSTING.md`](docs/SELF_HOSTING.md) (HTTPS, Tunnel, Tailscale).

Then in the app: **Profile → Self-hosted backend → URL + anon key**.

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
  sync.ts            # push/pull to the self-hosted backend
  predictions.ts     # Restock prediction logic
components/
  NativeSheet.tsx    # JS bottom sheet
  ui/                # Thin NativeWind primitives
backend/             # Self-contained Docker backend (optional)
metadata/
  *.yml              # F-Droid listing metadata
Makefile             # Developer shortcuts (make install / android / backend-up)
```

## Self-hosting (optional)

Glean is local-first and needs no server. To sync across devices, run the
bundled backend on any Docker host — see [Install → step 3](#3-run-the-backend-optional)
and [`backend/README.md`](backend/README.md).

## Data & Privacy

All data is stored locally in a SQLite database on your device. Nothing is
sent to a server, and there is no account or sign-in. Uninstalling the app
removes the data.

## Roadmap

Planned and deferred work lives in [`ROADMAP.md`](ROADMAP.md).

## License

Licensed under the Apache License, Version 2.0 — see [LICENSE](LICENSE) and
[NOTICE](NOTICE).
