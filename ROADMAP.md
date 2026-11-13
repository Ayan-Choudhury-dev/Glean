# Roadmap / backlog

Deferred work, roughly in priority order. Nothing here is started.

## Done

- **Release script** — `scripts/release.sh` bumps the version, builds per-ABI
  APKs and creates the GitHub release (dry by default; `CONFIRM=1` to publish).
- **Docs set** — `docs/ARCHITECTURE`, `MOBILE`, `APP_STORES`, `API`, `FAQ`,
  `DATA_IMPORTS`, plus `DESIGN.md`.
- **Store copy** — `fastlane/metadata/android/en-US/` listing text and changelog.
- **Cleanup** — dropped the unused `expo-clipboard` dependency and the legacy
  auth-based `supabase/` schema (superseded by `backend/init/01-schema.sql`).

## Release packaging

- **Smaller APK** — ✅ per-ABI split APKs (`arm64-v8a`, `armeabi-v7a`) are built
  and published, and the emulator ABIs are dropped. Remaining ideas:
  - R8 is on (`android.enableMinifyInReleaseBuilds=true` since the SDK 58
    upgrade); resource shrinking is still off.
  - Look for unused native code to trim.
- **Release keystore** — the current APK is signed with the development keystore.
  Generate a proper release keystore before publishing to Play.
- **F-Droid `Builds` entry** — `metadata/io.github.ayanchoudhurydev.glean.yml` has
  the listing but no `Builds` yet; needs a tagged release and an Expo build recipe.

## Sync

- **Realtime pull** — a second device currently only sees changes after a manual
  "Restore from server". Add a realtime subscription (or polling) for live sync.
- **Conflict resolution** — push-on-change is last-write-wins today.

## Web

- **Full web app** — the self-hosted backend serves a read-only dashboard. Serving
  the real Glean UI in the browser needs an Expo web build, with `expo-sqlite`
  web support and shims for native-only modules.

## Shelved

- **Google OAuth** — `lib/googleAuth.ts` and the onboarding button are kept but
  unused. Re-enable by setting `EXPO_PUBLIC_GOOGLE_*` and re-importing.
