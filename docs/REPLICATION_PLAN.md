# Replication plan: adopting the openGym playbook

Glean's repo should feel like openGym's: a self-hostable product with a
documented architecture, a reproducible release process, store metadata, and a
mobile app that works on its own or against your own server.

This is a plan, not a promise. It is phased so each step leaves the app working.

## What openGym has, mapped to Glean

| openGym | Glean today | Target |
|---|---|---|
| `frontend/` React + Vite + Capacitor | `app/` Expo Router (RN) | Stay Expo (see below) |
| `api/` Node `http` server | `backend/` Postgres + PostgREST (Docker) | Keep Supabase; document the API |
| `web/` nginx + Dockerfile | `backend/` nginx | Merge into `backend/web/` |
| `docker-compose.yml` at root | `backend/docker-compose.yml` | Add a root compose that points at `backend/` |
| `docs/` (ARCHITECTURE, SELF_HOSTING, MOBILE, APP_STORES, FAQ, API, …) | `docs/SELF_HOSTING.md` only | Add the full docs set |
| `scripts/` (android, ios, ci, media) | none | Add release/build/screenshot scripts |
| `fastlane/` store metadata | none | Add F-Droid + Play metadata |
| `.env.example`, `.dockerignore` | `.env` (local only) | Add both |
| `README`, `ROADMAP`, `CHANGELOG`, `CONTRIBUTING`, `SECURITY`, `NOTICE` | README + ROADMAP + NOTICE | Add the rest |
| Mobile: local vs server at first launch | ✅ added | Keep |
| Mobile: pairing a phone to a server | ❌ | Add (server-side token) |
| Mobile: self-updater | Check + prompt ✅ | Add in-app install |
| `DESIGN.md` + `PRODUCT.md` | PRODUCT.md ✅ | Add DESIGN.md via `/impeccable document` |

## The stack decision

**Decided: stay on Expo/RN.** A Capacitor + React (Vite) rewrite was tried and
discarded — it traded native iOS quality and `expo-sqlite`/`expo-camera` for a
webview wrapper, with no user-visible gain. Glean is a mobile-first product, so
the native app is the product.

What openGym's structure still buys us, without changing the stack:
- the docs set, scripts, store metadata and root compose file around `app/`;
- a browser build via `expo start --web` for quick iteration, not as the product;
- the same local-first → optional self-hosted server story.

## Phases

### Phase 1 — Repo and docs (stack-agnostic)
- Root `CONTRIBUTING.md`, `SECURITY.md`, `CHANGELOG.md`, `NOTICE.md`.
- `docs/`: ARCHITECTURE, SELF_HOSTING (+ HTTPS, Mac, Kubernetes), MOBILE,
  APP_STORES, FAQ, API, DATA_IMPORTS.
- `.env.example`, `.dockerignore`.
- Root `docker-compose.yml` that runs `backend/`.

### Phase 2 — Release process
- `scripts/release.sh`: bump version, build per-ABI APKs, name them
  `glean-<version>-<abi>.apk`, create the GitHub release.
- `scripts/screenshots.mjs`: capture store screenshots.
- `fastlane/metadata/android/en-US/` (title, short description, full description,
  changelog) + F-Droid `metadata/` already present.

### Phase 3 — CI
- GitHub Actions: `typecheck`, `test`, backend image publish (exists),
  APK release on tag (exists), docs link check.

### Phase 4 — Mobile parity
- Server pairing (openGym pairs a phone with a short-lived code).
- In-app APK install for updates (`REQUEST_INSTALL_PACKAGES` + FileProvider).
- Connection status line (offline / error / waiting changes).

### Phase 5 — Design system
- `/impeccable document` → `DESIGN.md` from the incumbent app.
- Keep `PRODUCT.md` current.

## Licensing note

openGym is **AGPL-3.0**; Glean is **Apache-2.0**. Replicate its *structure and
practices*, never copy its code or prose verbatim. Every file here is written
for Glean.
