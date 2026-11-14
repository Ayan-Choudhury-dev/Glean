#!/usr/bin/env bash
#
# Copy the built APKs into dist/release with release names, and refuse to ship
# one whose native libraries are incomplete. This is the check that would have
# caught 1.0.4 crashing on every 64-bit phone.
#
#   scripts/verify-apks.sh 1.0.10
set -euo pipefail

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "usage: scripts/verify-apks.sh <version>" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/dist/release"
APK_DIR="$ROOT/android/app/build/outputs/apk/release"
mkdir -p "$OUT"

REQUIRED=(libhermesvm.so libjsi.so libappmodules.so libworklets.so libreactnative.so)

for abi in arm64-v8a armeabi-v7a; do
  src="$APK_DIR/app-$abi-release.apk"
  if [[ ! -f "$src" ]]; then
    echo "missing $src" >&2
    exit 1
  fi

  dest="$OUT/glean-$VERSION-$abi.apk"
  cp "$src" "$dest"

  listing="$(unzip -l "$dest")"
  for lib in "${REQUIRED[@]}"; do
    if ! grep -q "lib/$abi/$lib" <<<"$listing"; then
      echo "glean-$VERSION-$abi.apk is missing lib/$abi/$lib" >&2
      exit 1
    fi
  done
  echo "ok: $abi"
done
