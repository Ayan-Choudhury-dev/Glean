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

## 1.0.10

- Self-hosted sync actually works: the app stopped sending an Authorization
  header that made the bundled PostgREST answer 500. Anyone who tried to
  connect a server before this release had a broken connection.
- The app understands two backends. Point it at a PocketBase server and it asks
  for that server's account instead of a key; everything else is unchanged.
- Joining a household is a six-character code, valid ten minutes, burned on use.
- Returning to the app refreshes from the server, so a second phone sees changes
  without the manual restore.
- The server can be locked with a shared token (`GLEAN_TOKEN`), and the app says
  so when a server rejects the key instead of blaming the address.
- Backups: `scripts/backend-backup.sh` and `backend-restore.sh`.

## 1.0.9

- Settings gains a Developer section: preview the update sheet, walk a download,
  post the ready notification, restart onboarding, seed a sample pantry.
- The scanner no longer blocks on picking a location, unknown products can be
  named inline, and there is a torch.
- Onboarding asks for the pantry name.
- Tap feedback uses Android's haptic constants instead of a vibrator buzz, and
  only where a tap changes data.

## 1.0.8

- Updates install in the app: the sheet shows progress, the notification fires
  when the APK is ready, and the download is kept so it can be installed later.
- Settings was reorganised: one Household card, no fake account rows, Accent
  inside Appearance, and the update row reports its state.
- Dialogs animate out as well as in.

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
