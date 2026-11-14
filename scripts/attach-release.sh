#!/usr/bin/env bash
#
# Attach the built APKs to the GitHub release for a version, creating it if it
# does not exist yet. Used by CI after the build, and by hand when a build was
# done locally.
#
#   scripts/attach-release.sh 1.0.10
#
# Needs `gh` authenticated (CI provides GITHUB_TOKEN).
set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "usage: scripts/attach-release.sh <version>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TAG="v$VERSION"
APKS=("$ROOT/dist/release/glean-$VERSION-arm64-v8a.apk" "$ROOT/dist/release/glean-$VERSION-armeabi-v7a.apk")

for apk in "${APKS[@]}"; do
  if [[ ! -f "$apk" ]]; then
    echo "missing $apk" >&2
    exit 1
  fi
done

if gh release view "$TAG" >/dev/null 2>&1; then
  gh release upload "$TAG" "${APKS[@]}" --clobber
  echo "uploaded to existing $TAG"
else
  gh release create "$TAG" "${APKS[@]}" --title "Glean $VERSION" --generate-notes
  echo "created $TAG"
fi
