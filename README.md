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

- [Expo](https://expo.dev) SDK 57 (Expo Router)
- [React Native](https://reactnative.dev) 0.86
- [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) — local storage
- [Zustand](https://zustand-demo.pmnd.rs) — state management
- [NativeWind](https://www.nativewind.dev) + Tailwind CSS — styling

## Getting Started

### Prerequisites

- Node.js 20+ (LTS recommended)
- Android Studio / Xcode for a native development build

### Installation

```bash
git clone https://github.com/Ayan-Choudhury-dev/Glean.git
cd Glean
npm install
```

### Running the App

The app uses native modules, so it needs a development build (not Expo Go):

```bash
# Android
npm run android

# iOS
npm run ios
```

### Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest run
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
  predictions.ts     # Restock prediction logic
components/
  NativeSheet.tsx    # JS bottom sheet
  ui/                # Thin NativeWind primitives
metadata/
  *.yml              # F-Droid listing metadata
```

## Data & Privacy

All data is stored locally in a SQLite database on your device. Nothing is
sent to a server, and there is no account or sign-in. Uninstalling the app
removes the data.

## License

Licensed under the Apache License, Version 2.0 — see [LICENSE](LICENSE) and
[NOTICE](NOTICE).
