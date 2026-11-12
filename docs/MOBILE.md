# Building and running Glean on a phone

Glean is an Expo SDK 58 / React Native 0.88 app using Expo Router. This page
covers local builds, preview APKs, installing on a device, updates, and common
errors.

## Why Expo Go does not work

The app uses native modules Expo Go does not bundle: `expo-sqlite` (database),
`expo-camera` (barcode scanning), `expo-image-picker` (item photos),
`expo-haptics` (tap feedback), `expo-sharing` and `expo-file-system` (CSV
export). You need a **development build** (`npx expo run:android` /
`npx expo run:ios`) or an **EAS build**. Expo Go will fail at runtime.

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Node.js | 22 or 24 LTS | SDK 58 does not support Node 23 |
| JDK | 17 | Anything else breaks the Gradle build |
| Android SDK | via Android Studio | `ANDROID_HOME` set, `platform-tools` on `PATH` |
| Xcode | current | macOS only, for iOS |
| Device | Android 7+ / iOS 15+ | USB or wireless debugging |

```bash
git clone https://github.com/Ayan-Choudhury-dev/Glean.git
cd Glean
npm install
```

## Android development build

```bash
npx expo run:android        # same as: make android
```

This prebuilds into the committed `android/` directory, compiles the APK,
installs it on the device, and starts Metro. The first build takes a few
minutes; later builds reuse Gradle's cache. Package
`io.github.ayanchoudhurydev.glean`, scheme `glean`.

Once a dev build is installed, JS-only changes need Metro, not a rebuild:

```bash
npx expo start              # or: npm start
npx expo start --clear      # reset the bundler cache
npx expo start --tunnel     # device on another network (npm run tunnel)
```

## iOS development build

There is **no `ios/` directory in the repo** — it is generated on demand:

```bash
npx expo prebuild --platform ios    # generates ios/
npx expo run:ios                    # build + install on simulator or device
```

iOS is **unverified**. The project has never been built or run on Apple
hardware, so treat anything iOS-specific as untested. No iOS artifact is
published.

## Building a preview APK

**EAS (cloud, no local Android SDK needed):**
`npx eas-cli build --profile preview --platform android`

`eas.json` profiles:

| Profile | Distribution | Artifact |
|---|---|---|
| `development` | internal, dev client | debug client for Metro |
| `preview` | internal | release APK (`android.buildType: apk`) |
| `production` | store | AAB, `autoIncrement` bumps the version code |

**Local Gradle:** `cd android && ./gradlew assembleRelease`, output in
`android/app/build/outputs/apk/release/`.

## Per-ABI splits

Release builds are split by CPU architecture (`splits.abi` in
`android/app/build.gradle`) with `include 'armeabi-v7a', 'arm64-v8a'` and
`universalApk false` — the x86/x86_64 emulator ABIs are dropped. One APK per
ABI, published under these names:

```
glean-1.0.3-arm64-v8a.apk     # 64-bit, most phones since ~2017
glean-1.0.3-armeabi-v7a.apk   # 32-bit, widest compatibility
```

Bundling both architectures roughly doubles download size. Try `arm64-v8a`
first; if Android refuses it, use `armeabi-v7a`.

## Installing on a phone

**USB:**

```bash
adb devices                                  # confirm the device is listed
adb install -r glean-1.0.3-arm64-v8a.apk     # -r replaces an existing install
```

**Wireless debugging** (Android 11+, no cable): enable *Developer options →
Wireless debugging → Pair device with pairing code*, then:

```bash
adb pair <ip>:<pair-port>     # enter the code when prompted
adb connect <ip>:<debug-port>
adb install -r glean-1.0.3-arm64-v8a.apk
```

Sideloading from a file manager also works; Android asks for permission the
first time.

## Updating the app

Published APKs live in GitHub releases (`v1.0.0` through `v1.0.3`). On launch
the app compares `app.json`'s `version` against the latest release tag
(`lib/updates.ts`) and, if the release is newer, offers a **Download** button
that opens the release page.

There is **no in-app installer**. Download the APK and install it over the old
one — the database survives (same package name), provided the signing key has
not changed.

## Troubleshooting

**JDK mismatch** — `Unsupported class file major version` or Gradle failing on
the JVM:

```bash
java -version                # must report 17
/usr/libexec/java_home -V    # macOS: list installed JDKs
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
```

**`INSTALL_FAILED_UPDATE_INCOMPATIBLE`** — the installed copy is signed with a
different key than the APK you are installing (common when switching between an
EAS build, a local debug build, and a release APK).

```bash
adb uninstall io.github.ayanchoudhurydev.glean
adb install -r glean-1.0.3-arm64-v8a.apk
```

Uninstalling wipes the local database — export a CSV from Settings first.

**Metro cache / stale bundle** — old code renders, or a module fails to resolve:

```bash
npx expo start --clear
rm -rf node_modules/.cache .expo
cd android && ./gradlew clean
```

**"App not installed" with no detail** — usually the wrong ABI. Try
`armeabi-v7a`.

**`Cannot find native module 'Expo…'`** — the installed app is an old dev build.
Re-run `npx expo run:android`; a JS reload cannot add native code.
