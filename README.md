# Glean

A smart pantry and shopping list app built with Expo and React Native. Glean tracks your household inventory, predicts when items will run out based on consumption history, and automatically surfaces restock suggestions.

## Features

- **Pantry Inventory** — Track items, quantities, categories and storage locations, with inline quantity steppers
- **Smart Shopping List** — To Buy / Purchased segments, per-item quantities, and one-tap "Update Pantry"
- **Suggested Restocks** — Items are surfaced automatically when stock is predicted to run low based on usage history (see `lib/predictions.ts`)
- **Consumption Tracking** — Logs usage over time to improve predictions and powers per-item activity timelines
- **Onboarding & House Setup** — Multi-user household setup flow with invite codes
- **Import / Export** — Paste CSV to bulk-import; export your inventory as a shareable CSV file

## Tech Stack

- [Expo](https://expo.dev) SDK 57 (Expo Router, native tabs)
- [React Native](https://reactnative.dev) 0.86
- [Supabase](https://supabase.com) — database & auth
- [Zustand](https://zustand-demo.pmnd.rs) — state management
- [NativeWind](https://www.nativewind.dev) + Tailwind CSS — styling
- [Vitest](https://vitest.dev) — unit tests for pure logic

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project with the schema from `supabase/schema.sql`

### Installation

```bash
git clone https://github.com/Ayan-Choudhury-dev/Glean.git
cd Glean
npm install
```

### Environment Variables

Create a `.env` file in the root:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Running the App

```bash
# Start Expo dev server (development build required — native modules)
npm start

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
  (tabs)/            # Tab screens: Inventory, Shopping list, Profile
  onboarding.tsx     # Auth (sign up / sign in / magic link)
  house-setup.tsx    # Household create / join
  item-form.tsx      # Add / edit inventory item
store/
  useGleanStore.ts   # Zustand store (inventory, shopping list, logs, auth)
lib/
  supabase.ts        # Supabase client
  predictions.ts     # Restock prediction logic (+ predictions.test.ts)
components/
  NativeSheet.tsx    # Native bottom-sheet wrapper (@expo/ui)
  ui/                # Thin NativeWind primitives (text, button, stacks, tappable)
supabase/
  schema.sql         # Database schema
  seed.sql           # Dev seed data
Design/
  glean_design.pen   # Source-of-truth design file
```

## Database Setup

Run the SQL files in order against your Supabase project:

```
supabase/schema.sql
supabase/seed.sql
```

## License

MIT
