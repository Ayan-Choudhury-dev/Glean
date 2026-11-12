# Shipping Glean

Glean currently reaches users one way: **an APK attached to a GitHub release**.
The other channels are prepared but not live. This page says exactly what each
one needs and what is still missing.

## Status at a glance

| Channel | Artifact | Version control | Status |
|---|---|---|---|
| GitHub releases (direct APK) | `glean-<version>-arm64-v8a.apk`, `glean-<version>-armeabi-v7a.apk` | `app.json` `version` + `versionCode` in `android/app/build.gradle` | **Live** — v1.0.0 through v1.0.3 |
| Google Play | `.aab` from the `production` EAS profile | Play version code (Play Console) | **Not started** — no release keystore, no listing |
| F-Droid | source build from a tagged commit | `versionName` / `versionCode` in the metadata file | **Not started** — metadata exists, no `Builds:` entry |
| Apple App Store | `.ipa` | App Store Connect | **Not started** — iOS has never been built |

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

`metadata/io.github.ayanchoudhurydev.glean.yml` already carries the listing:
categories Household/Food, `License: Apache-2.0`, source and issue tracker URLs,
summary, description, `RepoType: git`.

**The `Builds:` entry is missing** — it is a commented TODO. F-Droid builds from
source in a clean environment, and an Expo/React Native app needs its JS bundle
produced *before* Gradle runs, which the default recipe does not do. A working
recipe looks roughly like this (not yet validated):

```yaml
Builds:
  - versionName: 1.0.3
    versionCode: 4
    commit: v1.0.3
    subdir: android/app
    sudo:
      - npm install -g npm@10
    init: npm ci
    prebuild:
      - npm run --if-present prebuild
      - npx expo export:embed --platform android --dev false \
          --entry-file node_modules/expo-router/entry.js \
          --bundle-output android/app/src/main/assets/index.android.bundle \
          --assets-dest android/app/src/main/res
    gradle:
      - yes
    antifeatures:
      - UpstreamNonFree   # only if a non-free dependency is added later
```

Open questions before submitting: `node_modules` and the Gradle/NDK toolchain
must be fetched inside the F-Droid build VM, `expo export:embed` needs a
deterministic output, and the Android SDK/NDK versions must be pinned. Expect
iteration with F-Droid reviewers.

Inclusion policy fit:

- **No tracking** — no analytics, ads, crash reporting, or account. The only
  network calls are the optional self-hosted backend the user configures and the
  GitHub release check. F-Droid reviewers may ask for the update check to be
  removable or made opt-in; be ready to answer.
- **License** — Apache-2.0, GPL-compatible, accepted by F-Droid. `NOTICE` and
  `LICENSE` are in the repo.
- **Reproducibility** — F-Droid rebuilds from the tagged commit. The APK it
  ships is signed by F-Droid's key, so it cannot be installed over a
  GitHub-release APK; users switching channels must uninstall first (which wipes
  local data).
- **Version parity** — each F-Droid build needs a matching tag and a `Builds`
  entry, otherwise the listing goes stale.

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
