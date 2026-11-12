# Changelog

## Unreleased

- Dropped the Capacitor/React web rewrite; Glean stays a native Expo app.
- Docs: architecture, mobile builds, store status, API, CSV format, FAQ, design
  tokens.
- `scripts/release.sh` cuts a per-ABI APK release; `scripts/screenshots.mjs`
  captures store screenshots from a device.
- Play/F-Droid listing copy under `fastlane/metadata/android/en-US/`.
- Cleanup: removed the unused `expo-clipboard` dependency and the legacy
  auth-based `supabase/` schema.

## 1.0.5

- Settings shows when the pantry last synced, instead of a bare "Connected", and
  the About row reports the real app version.
- Fixes the 1.0.4 crash on 64-bit phones: the `arm64-v8a` build was missing its
  native libraries (`libworklets.so` and friends), so it died at launch.
- The release script now builds both ABIs in one Gradle run and refuses to ship
  an APK whose native libraries are incomplete.

## 1.0.4 — withdrawn

Broken on 64-bit devices; replaced by 1.0.5.

## 1.0.3

- New first-run welcome: what Glean does, your name, and a quick pick of common
  staples that fills the pantry.
- Choose where your pantry lives: on this device, or on a server you host.

## 1.0.2

- Smaller downloads: one APK per phone chip instead of a single large one.
- Clearer file names (`glean-<version>-<abi>.apk`).

## 1.0.1

- Fixed the first-run screen getting stuck on "Get started".

## 1.0.0

- First release: local-first pantry, shopping list, history, CSV import/export.
- Optional self-hosted backend for cross-device sync.
