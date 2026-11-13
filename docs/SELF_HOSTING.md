# Self-hosting the Glean backend

Glean is local-first: the app works with no server. Run this backend only if you
want to sync a pantry across devices.

The backend is **Postgres + PostgREST + nginx** in Docker. No Node, no build
step on the host.

## Which backend

Two options, same app:

| | PocketBase (recommended) | Postgres + PostgREST |
|---|---|---|
| Containers | 1 | 3 |
| Data | `pb_data/` directory | Postgres volume |
| Accounts | one per person, on your server | shared token |
| Live sync | yes, pushes as you type | refreshes when the app opens |
| Admin UI | yes, at `/_/` | none |

New installs: use PocketBase. The Postgres bundle still works and is documented
below; existing installs do not have to move.

### PocketBase in four commands

```bash
cd backend/pocketbase
cp .env.example .env
docker compose up -d          # http://<host>:8090
```

Then open `http://<host>:8090/_/`, create the superuser, run the bootstrap, and
create a household user:

```bash
PB_URL=http://<host>:8090 PB_ADMIN_EMAIL=you@example.com PB_ADMIN_PASSWORD=... \
  node scripts/pocketbase-bootstrap.mjs
```

In the app: **Settings → Add member → the address → your account**. Backups are
`pb_data/`, so `docker run --rm -v glean-pocketbase_pb_data:/d -v "$PWD":/b alpine tar czf /b/pb.tgz -C /d .`

## Quick start (Postgres + PostgREST)

```bash
git clone https://github.com/Ayan-Choudhury-dev/Glean.git
cd Glean/backend
cp .env.example .env          # set POSTGRES_PASSWORD
docker compose pull           # prebuilt images from GHCR
docker compose up -d
```

Or build from source instead of pulling:

```bash
docker compose up -d --build
```

Open `http://<host>:8000` for the read-only dashboard. The API is under
`/rest/v1/*`.

## Point the app at it

In Glean: **Settings → Add member**

- URL: `http://<host>:8000`
- Anon key: any non-empty string (e.g. `glean`)

**Test connection → Save & connect.** The app pushes changes as you make them;
**Restore from server** pulls a pantry back onto a new device.

## LAN only

That's the default and the safest. Use the host's LAN IP (not `localhost`), e.g.
`http://192.168.1.20:8000`, and keep port `8000` on your private network.

## HTTPS on a domain (recommended if the phone is not always on your LAN)

Put a TLS-terminating proxy in front. With [Caddy](https://caddyserver.com):

```
glean.example.com {
    reverse_proxy localhost:8000
}
```

Then set the app's URL to `https://glean.example.com`.

## Cloudflare Tunnel (no port forwarding)

```bash
cloudflared tunnel --url http://localhost:8000
```

Use the `https://…trycloudflare.com` URL in the app. For a stable hostname,
create a named tunnel and route `glean.example.com` to `http://localhost:8000`.

## Tailscale (private, no public exposure)

Install Tailscale on the server and the phone, then use the server's Tailscale
IP: `http://100.x.y.z:8000`. Nothing is exposed to the internet.

## Data and backups

All data lives in the `db_data` Docker volume.

```bash
scripts/backend-backup.sh                 # ./backups/glean-<date>.sql.gz
scripts/backend-backup.sh /mnt/nas        # somewhere else
scripts/backend-restore.sh backups/glean-20261113-101500.sql.gz
```

The dump is a plain `pg_dump`, a few hundred kilobytes, restorable into any
Postgres. Keep it out of the repo (it is gitignored) and copy it somewhere that
is not the machine running the server.

Reset (wipes data, re-applies the schema on next boot): `docker compose down -v`

## The shared token

Postgres has Row Level Security **off** and the API role can read and write
everything, so the token is the only thing standing between your pantry and
whoever can reach the port.

```bash
# in backend/.env
GLEAN_TOKEN=$(openssl rand -hex 24)
docker compose up -d          # picks it up on recreate
```

Then in the app: **Settings → Add member → Advanced**, paste the same value.
Every request carries it; nginx answers `401` without it. If the token is empty
the gate is disabled and the container prints a warning on start — fine on a
LAN, not fine on a public hostname.

Health check: `curl -f http://<host>:8000/healthz`.

## Upgrades

Images are pinned in `backend/docker-compose.yml`. To move to a newer release:

```bash
cd backend
docker compose pull
docker compose up -d
```

Schema changes ship in `backend/init/01-schema.sql`, which only runs on a fresh
volume. For an existing volume, apply the new statements by hand (the file is
idempotent: `create table if not exists`, `create index if not exists`):

```bash
docker compose exec -T db psql -U glean -d glean < init/01-schema.sql
```

Back up first. There is no downgrade path.

## Security

Beyond the token:

- The token is compared in nginx, so it never reaches Postgres or the dashboard.
- TLS matters more than the token: without it the token travels in clear text.
  Use the HTTPS or Tunnel sections above.
- The dashboard at `/` is read-only and needs no token; it only renders what the
  API already exposes to a browser on the same host.

## Ports

| Service | Container | Host |
|---|---|---|
| nginx (dashboard + API) | 80 | `${PORT:-8000}` |
| Postgres | 5432 | not published |
| PostgREST | 3000 | not published |
