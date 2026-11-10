# Glean self-hosted backend

A minimal, self-contained Docker backend for Glean: **Postgres + PostgREST** behind
an nginx proxy that maps the Supabase JS client's `/rest/v1/*` paths.

It is intentionally small: Glean authenticates locally, stores images on-device,
and only needs the REST API for sync. No GoTrue, Storage, Realtime, or Studio.

## Run it

```bash
cd backend
cp .env.example .env
# edit .env — at minimum change POSTGRES_PASSWORD
docker compose up -d
```

The API is then at:

```
http://<this-host>:8000
```

The database schema (`init/01-schema.sql`) is applied automatically on the
**first** boot (empty volume).

## Point the app at it

In Glean: **Profile → Self-hosted backend**

- URL: `http://<this-host>:8000`
- Anon key: any non-empty string (e.g. `glean`) — the bundled backend does not
  use JWT auth, so the value is ignored.

Then **Test connection → Save & connect**.

## Verify from the command line

```bash
curl -s http://localhost:8000/rest/v1/houses
# -> []
```

## Reset / re-apply the schema

The init script only runs on an empty data volume. To wipe and rebuild:

```bash
docker compose down -v
docker compose up -d
```

## Security

This backend has **RLS disabled** and no authentication — anyone who can reach
port 8000 can read and write all data. Run it only on a trusted network (LAN or
VPN). Before exposing it to the internet, put it behind TLS and real auth.

## Ports

| Service | Container | Host |
|---|---|---|
| nginx (API) | 80 | `${PORT:-8000}` |
| Postgres | 5432 | not published |
| PostgREST | 3000 | not published |
