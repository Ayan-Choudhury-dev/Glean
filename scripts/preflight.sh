#!/usr/bin/env bash
#
# Everything that must be true before a release is tagged.
#
#   scripts/preflight.sh
#
# A tag triggers a CI build that publishes to users, so the check belongs before
# the tag, not after it. `tsc` catches types; the bundle step catches imports
# and modules that only fail when Metro resolves them; the UI checks below catch
# the class of mistake that shipped 1.0.15 (state changed, nothing rendered).
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

step() { echo; echo "== $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

step "Typecheck"
npm run typecheck

step "Tests"
npm test

step "Bundle (catches imports Metro would fail on)"
OUT="$(mktemp -d)"
npx expo export --platform android --output-dir "$OUT" > /tmp/glean-preflight-export.log 2>&1 \
  || { tail -30 /tmp/glean-preflight-export.log; fail "expo export failed"; }
BUNDLE="$(find "$OUT" -name '*.hbc' -o -name '*.js' | head -1)"
[[ -n "$BUNDLE" ]] || fail "no bundle produced"
echo "ok: $(du -h "$BUNDLE" | cut -f1) bundle"
rm -rf "$OUT"

# --- UI wiring checks -------------------------------------------------------
# Every useState setter in a screen must appear in the rendered JSX, otherwise
# the state changes and the screen does not. This is the 1.0.15 bug, caught
# cheaply: `pbLogin` was set but never read in the tree.
step "Screens: state is rendered"
node scripts/check-screen-wiring.mjs

step "Docs: no links to removed files"
if grep -rn "backend/docker-compose.yml\|backend/README.md\|backend/nginx" \
    --include="*.md" . --exclude-dir=node_modules --exclude-dir=.git >/dev/null 2>&1; then
  grep -rn "backend/docker-compose.yml\|backend/README.md\|backend/nginx" \
    --include="*.md" . --exclude-dir=node_modules --exclude-dir=.git | head -5
  fail "docs point at files that no longer exist"
fi
echo "ok"

echo
echo "preflight passed — safe to tag"
