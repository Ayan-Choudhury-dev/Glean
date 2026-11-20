# Glean API

The optional backend is PocketBase: one container, SQLite, an admin panel at
`/_/`, and a small household page at `/`.

The Postgres + PostgREST bundle that came before it is no longer in this repo.
Its API is documented in git at `v1.0.13` (`docs/API.md` on that tag) for anyone
still running it; the app can still talk to it, but nothing new should start
there.

## Base URL

```
http://<host>:8090
```

## Auth

Every request carries the session token from:

```http
POST /api/collections/users/auth-with-password
Content-Type: application/json

{ "identity": "you@example.com", "password": "..." }
```

then `Authorization: <token>` on each call. Collections are readable and
writable by any authenticated user on that server — it is one household's
server, not a multi-tenant service.

## Collections

`houses`, `inventory`, `shopping_list`, `consumption_logs`, `house_options`,
`pairing_codes`. Each row keeps the app's uuid in a `uid` text field, unique per
collection; PocketBase's own `id` is 15 characters and is never exposed.

Created by `scripts/pocketbase-bootstrap.mjs`, which is idempotent.

## The calls the app makes

```http
GET    /api/collections/houses/records?page=1&perPage=1
GET    /api/collections/inventory/records?filter=house_id="<uuid>"
GET    /api/collections/houses/records?filter=uid="<uuid>"
POST   /api/collections/inventory/records
PATCH  /api/collections/inventory/records/<recordId>
GET    /api/realtime            (SSE, for change events)
```

Two gotchas, both found the hard way:

- an empty `filter` is a `400`; use `page`/`perPage` instead of `getFirstListItem('')`
- sorting on `created` is a `400` unless the collection has an autodate field

## Pairing

`pairing_codes` is the one collection readable without a session, because the
joining phone redeems before it can sign in. Rows are `code` (6 characters),
`house_id`, `expires_at`; they are deleted on first successful redemption.

## Security

Accounts live on your server, so the token never leaves it. Put TLS in front
before exposing it beyond the LAN — see `SELF_HOSTING.md`.
