# Glean

A smart pantry and shopping list app built with Expo and React Native. Glean tracks your household inventory, predicts when items will run out based on consumption history, and automatically surfaces restock suggestions.

## Features

- **Pantry Inventory** — Track items, quantities, and categories
- **Smart Shopping List** — Add items to buy, mark as purchased, and update your pantry in one tap
- **Suggested Restocks** — Items are surfaced automatically when stock is predicted to run low based on your usage patterns
- **Consumption Tracking** — Logs usage over time to improve predictions
- **Onboarding & House Setup** — Multi-user household setup flow

## Tech Stack

- [Expo](https://expo.dev) (SDK 54, Expo Router)
- [React Native](https://reactnative.dev) 0.81
- [Supabase](https://supabase.com) — database & auth
- [Zustand](https://zustand-demo.pmnd.rs) — state management
- [NativeWind](https://www.nativewind.dev) + [Gluestack UI](https://gluestack.io) — styling

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
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
# Start Expo dev server
npm start

# Android
npm run android

# iOS
npm run ios
```

## Project Structure

```
app/
  (tabs)/         # Tab screens: Home, Shopping, Profile
  onboarding.tsx  # Onboarding flow
  house-setup.tsx # Household setup
  item-form.tsx   # Add/edit inventory items
store/
  useGleanStore.ts  # Zustand store (inventory, shopping list, logs)
supabase/
  schema.sql        # Database schema
  seed.sql          # Seed data
components/
  ui/               # Gluestack UI primitives
```

## Database Setup

Run the SQL files in order against your Supabase project:

```
supabase/schema.sql
supabase/seed.sql
```

## License

MIT
