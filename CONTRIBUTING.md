# Contributing to Glean

Thanks for helping. Glean is a local-first pantry app; keep changes small and
focused.

## Before you start

- Open an issue for anything larger than a typo or a one-file fix.
- Read [`PRODUCT.md`](PRODUCT.md) for who the app is for, and
  [`docs/REPLICATION_PLAN.md`](docs/REPLICATION_PLAN.md) for where it is going.

## Setup

- Node.js **22 or 24 LTS** (SDK 58 does not support Node 23)
- JDK 17 and the Android SDK for a native build
- Docker for the optional backend

```bash
npm install
npx expo run:android      # or: make android
```

## Checks

```bash
npm run typecheck   # tsc --noEmit
npm test            # vitest
```

## Style

- TypeScript strict. Avoid `any` unless there is no alternative.
- Keep data access in `lib/db/` and `store/`; screens stay presentational.
- Commit messages describe the user-visible change, not the list of files.

## License

By contributing you agree your work is licensed under Apache-2.0. See
[`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).
