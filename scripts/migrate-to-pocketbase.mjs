#!/usr/bin/env node
//
// Move an existing pantry from the Postgres/PostgREST backend to PocketBase.
//
//   OLD_URL=http://192.168.1.20:8000 OLD_KEY=<token> \
//   PB_URL=http://localhost:8090 PB_USER=you@example.com PB_PASSWORD=... \
//   node scripts/migrate-to-pocketbase.mjs
//
// Reads through the old REST API rather than a pg_dump, so it works against a
// running server and needs nothing installed locally. Run it against a copy of
// the volume first: it writes into PocketBase and never touches the source.
//
// The uuid in each row is preserved as `uid` — PocketBase ids are 15-char
// alphanumerics, and rewriting them would mean migrating every device too.

const OLD_URL = (process.env.OLD_URL ?? '').replace(/\/+$/, '');
const OLD_KEY = process.env.OLD_KEY ?? 'glean';
const PB_URL = (process.env.PB_URL ?? 'http://localhost:8090').replace(/\/+$/, '');
const PB_USER = process.env.PB_USER;
const PB_PASSWORD = process.env.PB_PASSWORD;

if (!OLD_URL || !PB_USER || !PB_PASSWORD) {
  console.error('OLD_URL, PB_USER and PB_PASSWORD are required');
  process.exit(1);
}

const TABLES = ['houses', 'inventory', 'shopping_list', 'consumption_logs', 'house_options'];

async function oldRows(table) {
  const res = await fetch(`${OLD_URL}/rest/v1/${table}?select=*`, {
    // PostgREST without a JWT secret rejects an Authorization header with 500,
    // so only the token nginx checks is sent.
    headers: { apikey: OLD_KEY },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function pb(path, options = {}, token) {
  const res = await fetch(`${PB_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: token } : {}),
      ...(options.headers ?? {}),
    },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

/** PostgREST rows carry the uuid in `id`; PocketBase wants it in `uid`. */
function toPocketBase(table, row) {
  const { id, created_at, ...rest } = row;
  return { ...rest, uid: id };
}

async function main() {
  const auth = await pb('/api/collections/users/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: PB_USER, password: PB_PASSWORD }),
  });
  if (!auth.ok) {
    console.error('Could not sign in to PocketBase', auth.status, auth.body);
    process.exit(1);
  }
  const token = auth.body.token;

  let total = 0;
  for (const table of TABLES) {
    const rows = await oldRows(table);
    let moved = 0;
    for (const row of rows) {
      const created = await pb(`/api/collections/${table}/records`, {
        method: 'POST',
        body: JSON.stringify(toPocketBase(table, row)),
      }, token);
      // 400 usually means the record already exists (duplicate uid) — safe to skip.
      if (!created.ok && created.status !== 400) {
        console.error(`fail ${table}`, created.status, created.body);
        process.exit(1);
      }
      moved += 1;
    }
    total += moved;
    console.log(`${table.padEnd(17)} ${String(moved).padStart(4)} rows`);
  }

  console.log(`\nmoved ${total} rows. Verify counts in the PocketBase UI before cutover.`);
  console.log('The old server is untouched; keep its volume until a release has shipped.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
