# Roadmap / backlog

Deferred work, roughly in priority order. Nothing here is started.

## Release packaging

- **Smaller APK** — the v1.0.0 release is ~128 MB because it bundles four ABIs
  (`arm64-v8a`, `armeabi-v7a`, `x86`, `x86_64`) plus Reanimated's native code.
  Options, cheapest first:
  - Build for real devices only:
    `./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`
  - Per-ABI split APKs via `splits { abi { ... } }` in `android/app/build.gradle`.
  - Enable R8 / resource shrinking for the release build (currently off).
  - Drop the emulator ABIs (`x86`, `x86_64`) from shipped builds.
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

## Cleanup

- Remove the unused `expo-clipboard` dependency.
- Delete or archive the legacy `supabase/schema.sql` + `seed.sql` (auth-based,
  superseded by `backend/init/01-schema.sql`).
