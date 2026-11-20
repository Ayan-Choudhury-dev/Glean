# Changelog

## 1.0.18

- Saving an edit keeps you on the item instead of throwing you back to the list.
- Tap the item photo to replace it; long press still opens the viewer.
- Category and location on a new item now say "Change" and carry quick-pick
  chips, so the suggestion can be corrected without opening a sheet.

## 1.0.17

- The household has a web UI at the server: sign in, see members, add or remove
  an account, and make a joining code with a QR.
- Scanning that QR with the camera app opens Glean with the address and code
  filled in.
- Restock suggestions only appear when there is evidence: a measured rate from
  two or more uses, or a pantry untouched for three weeks. Category guesses no
  longer count.
- Item detail shows a 30-day stock sparkline and the measured usage rate.
- Adding an item is two steps: name and quantity, then where it lives, with the
  category guessed from the name.

## 1.0.16

- Fixed: connecting to a PocketBase server showed no sign-in fields, and the
  "this server is empty → upload" card was missing. Both were regressions from
  the 1.0.14 rebuild.
- Releases now run a preflight (types, tests, a real bundle, and a check that
  every screen state actually renders) before a tag is pushed.

## 1.0.15

- Category and location pickers open again inside the item form.

## 1.0.14

- Add member asks one question first — I have a code, I run the server, or I
  haven't set one up — and shows only that path's fields.
- The self-hosted backend is PocketBase. The Postgres bundle is gone from the
  repo; its compose file remains in git at v1.0.13.
- Restock suggestions can be turned on again; the add-item sheet stays open
  across adds; clearing purchased tears the receipt away.

## 1.0.13

- The "stocked" stamp stays on screen before the shopping list switches tabs.

## 1.0.12

- Tap feedback uses a 12 ms vibration, which is what the phone can actually feel.
- Category and location pickers use the gesture sheet.

## 1.0.11

- Haptics moved off the vibrator buzz and onto the system gesture constants, with
  a bench in Developer to compare them.
- Sheets let go: a downward drag hands off from a scrolled list.

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
