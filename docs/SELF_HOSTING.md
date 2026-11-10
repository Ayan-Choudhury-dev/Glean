# Self-hosting the Glean backend

Glean is local-first: the app works with no server. Run this backend only if you
want to sync a pantry across devices.

The backend is **Postgres + PostgREST + nginx** in Docker. No Node, no build
step on the host.

## Quick start

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

In Glean: **Profile → Self-hosted backend**

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

- All data lives in the `db_data` Docker volume.
- Back up: `docker run --rm -v glean_db_data:/data -v "$PWD":/backup alpine tar czf /backup/glean-db.tgz -C /data .`
- Reset (wipes data and re-applies the schema on next boot): `docker compose down -v`

## Security

The bundled schema disables Row Level Security and has **no authentication** —
anyone who can reach the API can read and write everything. Keep it on a trusted
network, or add TLS + real auth before exposing it publicly.

## Ports

| Service | Container | Host |
|---|---|---|
| nginx (dashboard + API) | 80 | `${PORT:-8000}` |
| Postgres | 5432 | not published |
| PostgREST | 3000 | not published |
