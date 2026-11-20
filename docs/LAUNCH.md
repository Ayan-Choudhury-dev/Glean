# Launch checklist

What is done, and what stands between the repo and a public release.

## Ready

```
app          pantry, shopping list, barcode scan, CSV, dark mode, accent presets
storage      SQLite on device; survives force-quit
sync         PocketBase: accounts, live updates, six-character joining codes
updates      in-app install, progress sheet, one notification, saved APK
backend      one Docker container + household web UI (members, codes, QR)
CI           tag → GitHub Actions builds both ABIs, verifies native libs, publishes
gate         scripts/preflight.sh runs before any tag
docs         architecture, API, mobile, stores, self-hosting, FAQ, design, launch
store copy   fastlane/metadata/android/en-US (title, short + full description)
F-Droid      metadata with a Builds entry for v1.0.18
license      Apache-2.0, NOTICE
```

## Before the first public post

1. **Rotate the server credentials.** `admin@glean.local` and the household
   accounts have been shared in plain text during development. Change the
   superuser in `/_/`, and set a new password for each household account.
2. **Decide on the signing key.** GitHub APKs are debug-signed. F-Droid signs
   its own, so the two are not interchangeable: a user who installs one cannot
   update to the other without uninstalling. If that matters, generate a release
   keystore and re-cut; if not, say so in the release notes.
3. **Screenshots.** `scripts/screenshots.mjs` walks a connected phone through
   five screens and writes into `fastlane/.../phoneScreenshots/`. Nothing there
   yet — the store listings need them.
4. **Write the release notes** for the tag (the workflow generates them from
   commits, which reads like commit subjects).

## F-Droid

The recipe in `metadata/io.github.ayanchoudhurydev.glean.yml` has never run on
their buildserver. Expect two or three rounds, in this order of likelihood:

```
1  NDK version          Expo SDK 58 expects a specific r-version; `ndk:` is the knob
2  npm ci offline       the buildserver has no network; every dependency must
                        install from the local cache
3  Gradle plugins       same constraint, AGP 8.x and the Expo modules
4  scanner entries      prebuilt .aar files under android/ may need scanignore
```

Submit by opening an MR on `fdroiddata` that adds the `metadata/` file, then
answer the build log. `AutoUpdateMode: Version` + `UpdateCheckMode: Tags` means
later releases follow tags automatically.

## Not shipping in this release

```
iOS            never built; the code has Android-shaped paths
Play Store     blocked on the release keystore
owner-only member management   any account on the server can add or remove others
web pantry     the server page manages the household, not the stock
```

## Known limits worth stating publicly

- Sync is last-write-wins per row. Two phones editing the same item offline will
  clobber, and the later write wins.
- Restock suggestions need history. A new pantry suggests nothing until items
  have been used twice, or untouched for three weeks.
- The joining QR needs a phone on a build that handles `glean://join`.
