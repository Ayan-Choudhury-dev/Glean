#!/usr/bin/env bash
#
# Cut a Glean Android release: bump version, verify, build per-ABI APKs, then
# (only with CONFIRM=1) commit, tag, push and publish on GitHub.
#
#   scripts/release.sh 1.0.10                       # build only, print next steps
#   CONFIRM=1 scripts/release.sh 1.0.10             # build + commit + tag + publish
#   SKIP_BUILD=1 CONFIRM=1 scripts/release.sh 1.0.10  # tag only; CI builds it
#
set -euo pipefail

VERSION="${1:-}"
if [[ ! "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "usage: scripts/release.sh <version>   (e.g. 1.0.4, no leading v)" >&2
  echo "       CONFIRM=1 scripts/release.sh <version>   to also tag and publish" >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
TAG="v$VERSION"
DIST="$REPO_ROOT/dist/release"
APK_DIR="android/app/build/outputs/apk/release"
ABIS=(arm64-v8a armeabi-v7a)
CURRENT_VERSION="$(node -p "require('./app.json').expo.version")"

step() { echo; echo "== $*"; }
run()  { echo "+ $*"; "$@"; }
die()  { echo "error: $*" >&2; exit 1; }

# ── Preflight ────────────────────────────────────────────────────────────────
step "Preflight"
command -v node >/dev/null || die "node not found (need Node 22 or 24)"
command -v npm  >/dev/null || die "npm not found"
command -v gh   >/dev/null || die "gh not found (install the GitHub CLI)"
command -v java >/dev/null || die "java not found (need JDK 17)"
[[ -z "$(git status --porcelain)" ]] || die "git tree is dirty; commit or stash first"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[[ "$BRANCH" == "main" ]] || die "on branch '$BRANCH', expected 'main'"
[[ "$VERSION" != "$CURRENT_VERSION" ]] \
  || die "app.json is already at $CURRENT_VERSION; pass a new version"
NEWER="$(node -e 'const [a,b]=process.argv.slice(1).map(v=>v.split(".").map(Number));
let r="0"; for(let i=0;i<3;i++){ if(a[i]!==b[i]){ r=a[i]>b[i]?"1":"0"; break; } } console.log(r);' "$VERSION" "$CURRENT_VERSION")"
[[ "$NEWER" == "1" ]] || die "version $VERSION is older than current $CURRENT_VERSION"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  die "tag $TAG already exists"
fi
echo "current: $CURRENT_VERSION"
echo "target:  $VERSION"

# ── Version bump ─────────────────────────────────────────────────────────────
step "Bumping expo.version to $VERSION in app.json"
run node -e '
  const fs = require("fs");
  const json = JSON.parse(fs.readFileSync("app.json", "utf8"));
  json.expo.version = process.argv[1];
  fs.writeFileSync("app.json", JSON.stringify(json, null, 2) + "\n");
' "$VERSION"

# ── Checks ───────────────────────────────────────────────────────────────────
step "Typecheck"
run npm run typecheck
step "Tests"
run npm test

# ── Native project ───────────────────────────────────────────────────────────
if [[ ! -d android ]]; then
  step "android/ missing; generating it"
  run npx expo prebuild --platform android --no-install
fi

# Gradle's versionName/versionCode are what the installed APK reports, so they
# must move with app.json or the release ships the previous version.
if [[ -f android/app/build.gradle ]]; then
  step "Bumping versionName/versionCode in android/app/build.gradle"
  run node -e '
    const fs = require("fs");
    const file = "android/app/build.gradle";
    let src = fs.readFileSync(file, "utf8");
    src = src.replace(/versionCode\s+\d+/, (m) => m.replace(/\d+/, (n) => String(Number(n) + 1)));
    src = src.replace(/versionName\s+"[^"]*"/, `versionName "${process.argv[1]}"`);
    fs.writeFileSync(file, src);
  ' "$VERSION"
fi

# ── Build ────────────────────────────────────────────────────────────────────
# SKIP_BUILD=1 tags the release and lets GitHub Actions build it, so the laptop
# is not pinned for six minutes. CI runs scripts/verify-apks.sh and attaches the
# APKs itself.
if [[ "${SKIP_BUILD:-}" == "1" ]]; then
  step "Skipping the build (SKIP_BUILD=1) — CI builds and attaches the APKs"
else
# One Gradle run for both ABIs: `splits.abi` emits one APK per architecture, so
# building them separately only risks stale native-lib state between runs (that
# is how 1.0.4 shipped an arm64 APK with no libworklets.so).
# Signing still uses the debug keystore; see ROADMAP "Release keystore".
step "Building release APKs (arm64-v8a, armeabi-v7a)"
( cd android && run ./gradlew clean assembleRelease \
  -PreactNativeArchitectures=arm64-v8a,armeabi-v7a )

step "Collecting APKs into dist/release"
run mkdir -p "$DIST"
# Expo's template emits `app-<abi>-release.apk` when splits are on, and a single
# `app-release.apk` when they are not. Accept either.
for abi in "${ABIS[@]}"; do
  src=""
  for candidate in "$APK_DIR/app-$abi-release.apk" "$APK_DIR/app-release.apk"; do
    if [[ -f "$candidate" ]]; then src="$candidate"; break; fi
  done
  [[ -n "$src" ]] || die "no release APK found in $APK_DIR for $abi"
  run cp "$src" "$DIST/glean-$VERSION-$abi.apk"
done

# A release that installs but dies on launch is worse than a failed build.
# Every APK must carry the JSI/Hermes libs and the worklets runtime.
step "Verifying native libraries"
REQUIRED_LIBS=(libhermesvm.so libjsi.so libappmodules.so libworklets.so libreactnative.so)
for abi in "${ABIS[@]}"; do
  apk="$DIST/glean-$VERSION-$abi.apk"
  listing="$(unzip -l "$apk")"
  for lib in "${REQUIRED_LIBS[@]}"; do
    grep -q "lib/$abi/$lib" <<<"$listing" \
      || die "$apk is missing lib/$abi/$lib"
  done
  echo "ok: $abi has ${#REQUIRED_LIBS[@]} required libs"
done
fi

# ── Publish ──────────────────────────────────────────────────────────────────
if [[ "${CONFIRM:-}" != "1" ]]; then
  step "Build only (CONFIRM is not 1)"
  cat <<EOF
APKs are ready in dist/release:
  dist/release/glean-$VERSION-arm64-v8a.apk
  dist/release/glean-$VERSION-armeabi-v7a.apk

app.json is modified in the working tree. To finish the release:
  git add app.json android/app/build.gradle
  git commit -m "chore: release v$VERSION"
  git tag -a $TAG -m "Glean $TAG"
  git push origin main
  git push origin $TAG
  gh release create $TAG \\
    dist/release/glean-$VERSION-arm64-v8a.apk \\
    dist/release/glean-$VERSION-armeabi-v7a.apk \\
    --title "Glean $VERSION" --generate-notes

Or re-run with CONFIRM=1 to do all of the above.
EOF
  exit 0
fi

step "Committing version bump"
run git add app.json android/app/build.gradle
run git commit -m "chore: release v$VERSION"
step "Tagging $TAG"
run git tag -a "$TAG" -m "Glean $TAG"
step "Pushing"
run git push origin main
run git push origin "$TAG"
if [[ "${SKIP_BUILD:-}" == "1" ]]; then
  step "Tag pushed — GitHub Actions is building and will attach the APKs"
  echo "Watch: gh run watch   (or the Actions tab)"
else
  step "Creating GitHub release"
  run bash scripts/attach-release.sh "$VERSION"
fi

echo
echo "Released $TAG"
