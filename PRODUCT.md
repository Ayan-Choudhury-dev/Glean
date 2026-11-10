# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Home cooks and shared households — families and flatmates who run one kitchen
together. They want to know what is already in stock before shopping, avoid
buying duplicates, and keep a shopping list the whole household can act on.

## Product Purpose

Glean is a pantry and shopping-list tracker that lives on the user's device. It
helps a household see what it has, notice what is running low, and build a
shopping list — then restock the pantry in one tap. Success means a user stops
guessing what is in the cupboard and stops running out of staples.

## Positioning

Local-first and account-free: the pantry works fully offline in a local SQLite
database with no sign-up, and a self-hosted backend is optional for syncing
across devices. Most pantry apps require an account on someone else's server;
Glean requires neither.

## Operating Context

- Used while cooking, unpacking groceries, and planning a shop.
- One-handed use in a kitchen; quick quantity adjustments matter more than deep settings.
- A household may share one phone or sync a few devices through a self-hosted server.

## Capabilities and Constraints

- Pantry inventory: name, quantity, category, location, optional photo and barcode.
- Shopping list: to-buy / purchased, per-item quantity, one-tap "update pantry".
- Consumption history and restock predictions.
- CSV import and export.
- Local SQLite is the source of truth; the app runs with no backend.
- Optional self-hosted Supabase backend for cross-device sync.
- Android app built with Expo / React Native; Apache-2.0, FOSS.

## Brand Commitments

- Name: Glean.
- Tone: warm, calm, homey.
- Existing visual identity to preserve: cream/paper palette, Fraunces display
  serif with Geist sans, hand-drawn grocery category illustrations.

## Evidence on Hand

- Real grocery category illustrations in `assets/images/categories/`.
- No testimonials, customer counts, pricing, or benchmarks exist; do not invent them.

## Product Principles

1. The pantry works before the account: nothing about setup may block the first item.
2. Reduce the work of maintaining it: quick taps, sensible defaults, no data-entry theatre.
3. Warm and calm, never clinical: a well-kept kitchen, not a database.
4. Household truth over individual guesswork: everyone sees the same list.
5. Own your data: local by default, sync only when you choose to host it.

## Accessibility & Inclusion

- Touch targets sized for one-handed kitchen use; respect reduced motion.
- Readable at arm's length; supports system light and dark.
