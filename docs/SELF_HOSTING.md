# Self-hosting the Glean backend

Glean is local-first: the app works with no server. Run this backend only if you
want a pantry shared across devices.

The backend is **PocketBase**: one container, SQLite in a volume, an admin UI at
`/_/`, and realtime so two phones see each other's changes.

## Which backend

PocketBase is the only one this repo ships. The Postgres + PostgREST bundle that
came before it is gone; if you still run it, its compose file is in git at
`v1.0.13`, and its containers keep running until you stop them.

## PocketBase in four commands

```bash
cd backend/pocketbase
cp .env.example .env
docker compose up -d          # http://<host>:8090
```

That is the whole install. Two things remain, both in the browser:

1. Open `http://<host>:8090/_/`. PocketBase asks you to create its superuser —
   that is the admin password, not a household one.
2. Settings → **Import collections**, and drop in
   `backend/pocketbase/collections.json`. That creates the six tables, their
   rules, and the invite fields.

Then open `http://<host>:8090/` and use **Add a member** to create the first
household account. Send that link to the people you live with; they choose their
own passwords.

No Node, no CLI, nothing to run from another machine. `collections.json` is
generated from a working server, so it always matches the app.

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

Everything is `pb_data/` inside the `glean-pocketbase_pb_data` volume.

```bash
# copy the volume somewhere that is not this machine
docker run --rm \
  -v glean-pocketbase_pb_data:/data \
  -v "$PWD":/backup \
  alpine tar czf /backup/glean-pb-$(date +%F).tgz -C /data .
```

Restore by extracting back into the volume with the container stopped. The
admin UI also has Settings → Backups, which writes into `pb_data/backups`.

Reset (wipes everything): `docker compose down -v`

## Upgrades

The image is pinned in `backend/pocketbase/docker-compose.yml`.

```bash
cd backend/pocketbase
docker compose pull
docker compose up -d
```

Back up first. PocketBase runs its own migrations on start; there is no
downgrade path.

## Security

- Accounts are PocketBase users on your server; there is no account with us.
- TLS matters: without it the session token travels in clear text. Use the HTTPS
  or Tunnel sections above before exposing this beyond the LAN.
- Collection rules allow any authenticated user on that server to read and write
  the household's rows. That is the single-household model, not a multi-tenant
  service.

## Ports

| Service | Container | Host |
|---|---|---|
| PocketBase (API + admin UI) | 8090 | `${PORT:-8090}` |

The Postgres bundle that used to live in `backend/` is gone from this repo. If
you still run it, its compose file is in your git history at `v1.0.13` and its
containers keep running until you `docker compose down` in that directory.
