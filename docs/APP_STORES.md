# Shipping Glean

Glean currently reaches users one way: **an APK attached to a GitHub release**.
The other channels are prepared but not live. This page says exactly what each
one needs and what is still missing.

## Status at a glance

| Channel | Artifact | Version control | Status |
|---|---|---|---|
| GitHub releases (direct APK) | `glean-<version>-arm64-v8a.apk`, `glean-<version>-armeabi-v7a.apk` | `app.json` `version` + `versionCode` in `android/app/build.gradle` | **Live** — v1.0.0 through v1.0.13, built by GitHub Actions |
| Google Play | `.aab` from the `production` EAS profile | Play version code (Play Console) | **Not started** — no release keystore, no listing |
| F-Droid | source build from a tagged commit | `versionName` / `versionCode` in the metadata file | **Recipe drafted** — `metadata/*.yml` has a `Builds:` entry for v1.0.13, untested on their buildserver |


## 1. Direct APK (current channel)

How it works today:

1. `version` in `app.json` and `versionName`/`versionCode` in
   `android/app/build.gradle` are bumped together (currently `1.0.3` / `4`).
2. A release build produces per-ABI splits (`android/app/build.gradle`,
   `splits.abi`: `armeabi-v7a`, `arm64-v8a`, `universalApk false`).
3. The two APKs are renamed `glean-<version>-<abi>.apk` and attached to a GitHub
   release tagged `v<version>`.
4. On launch the app fetches
   `https://api.github.com/repos/Ayan-Choudhury-dev/Glean/releases/latest` and
   compares `tag_name` to `app.json`'s version (`lib/updates.ts`). Newer → a
   dialog with a **Download** button that opens the release page.

**Missing:** an in-app installer. The user downloads the APK and installs it
manually over the existing app. `REQUEST_INSTALL_PACKAGES` is not declared.

**Known limitation:** release builds are signed with the committed
`android/app/debug.keystore` (`signingConfig signingConfigs.debug` in the
release block). That is acceptable for a self-published APK only as long as the
key never changes — every future APK must be signed with the same key or
upgrades fail with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`.

## 2. Google Play

Requirements, none of which are done yet:

- **Release keystore.** Generate one and keep it out of the repo:

  ```bash
  keytool -genkeypair -v -keystore glean-release.keystore \
    -alias glean -keyalg RSA -keysize 2048 -validity 10000
  ```

  Wire it in through `android/gradle.properties` (git-ignored) or EAS
  credentials (`eas credentials`). Do not commit the keystore or its passwords.
- **AAB.** Play rejects APKs. Use the `production` EAS profile (`eas.json`:
  `autoIncrement: true`) which builds an AAB, or
  `./gradlew bundleRelease` locally.
- **Version code.** `autoIncrement` with `appVersionSource: remote` keeps the
  Play version code in EAS. Once Play is the channel, never let it collide with
  codes already used by released APKs.
- **Data safety form.** Answer honestly: no account, no analytics, no crash
  reporting, no ad SDK. Data stored on device only. Network calls: an optional
  user-supplied self-hosted URL, plus the GitHub releases check in
  `lib/updates.ts`. Declare the camera permission (`android.permission.CAMERA`,
  used for barcode scanning) and that photos stay on device.
- **Store listing.** Short description, full description, screenshots per
  device class, feature graphic, 512×512 icon. Suggested copy, matching the
  F-Droid metadata:

  > **Short:** Track your pantry and shopping list, entirely on your device.
  >
  > **Full:** Glean is a local-first pantry tracker. Keep track of what is in
  > your kitchen, know what is running low, and build a shopping list — all
  > stored on your device with no account and no server.

- **Policy notes.** No tracking SDK, so no consent flow is needed. Play requires
  a privacy policy URL even for local-only apps; host one that states the above.
- **Closed testing** before production on a new developer account.

## 3. F-Droid

F-Droid builds from source and **signs with its own key**, so the debug keystore
in `android/app/build.gradle` does not block this channel. It does mean a user
cannot move between the GitHub APK and the F-Droid build without uninstalling —
different signing keys, same package name.

The recipe is drafted in `metadata/io.github.ayanchoudhurydev.glean.yml` for
v1.0.13 and has **not** been run on their buildserver:

```
subdir      android/app     android/ is committed, so no expo prebuild
init        npm ci          lockfile is against Node 22
srclibs     nodejs@22
sudo        openjdk-17-jdk-headless
gradle      yes             assembleRelease also produces the JS bundle
ndk         r27c
output      app/build/outputs/apk/release/app-release.apk
auto-update Version + Tags, so a new tag is a new release
```

Known risks, in the order they usually bite:

1. **NDK version** — Expo SDK 58 expects a specific r-version; `ndk:` is the knob.
2. **`npm ci` offline** — the buildserver has no network; every dependency must
   install from the local cache.
3. **Gradle plugin downloads** — same constraint; relies on their plugin cache
   carrying AGP 8.x and the Expo modules.
4. **Proprietary bits** — there are none: no Play Services, no Firebase, no
   Crashlytics. `expo-notifications` uses the OS scheduler locally.

Expect `scanner`/`scanignore` entries for the prebuilt `.aar`s under `android/`,
and two or three iterations before the recipe is accepted.

## 4. iOS

No `ios/` directory is committed and no build has ever been produced. Shipping
would need: an Apple Developer account, `npx expo prebuild --platform ios`, a
signing profile, App Store Connect metadata, and a privacy manifest
(`PrivacyInfo.xcprivacy`) for the APIs used. None of that exists. See
[MOBILE.md](MOBILE.md#ios-development-build).

## Checklist before the next release

- [ ] Bump `app.json` `version`, `versionName`, and `versionCode` together
- [ ] `npm run typecheck` and `npm test` pass
- [ ] Build both ABI splits, rename to `glean-<version>-<abi>.apk`
- [ ] Smoke-test on a physical arm64 device and a 32-bit device if available
- [ ] Tag `v<version>`, attach APKs, write release notes
- [ ] Confirm the in-app update dialog appears for the previous version
