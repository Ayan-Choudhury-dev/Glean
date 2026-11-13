#!/usr/bin/env node
//
// Create the Glean collections in a fresh PocketBase.
//
//   PB_URL=http://localhost:8090 \
//   PB_ADMIN_EMAIL=you@example.com \
//   PB_ADMIN_PASSWORD=... \
//   node scripts/pocketbase-bootstrap.mjs
//
// Idempotent: collections that already exist are left alone. Every collection
// carries a `uid` text field because our rows key on UUIDs and PocketBase ids
// are 15-char alphanumerics — keeping the uuid means the phone's SQLite never
// has to change (see docs/MIGRATION_POCKETBASE.md).

const BASE = (process.env.PB_URL ?? 'http://localhost:8090').replace(/\/+$/, '');
const EMAIL = process.env.PB_ADMIN_EMAIL;
const PASSWORD = process.env.PB_ADMIN_PASSWORD;

if (!EMAIL || !PASSWORD) {
  console.error('PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD are required');
  process.exit(1);
}

const uid = { name: 'uid', type: 'text', required: true, max: 64 };
const houseId = { name: 'house_id', type: 'text', required: true, max: 64 };

const collections = [
  {
    name: 'houses',
    fields: [
      uid,
      { name: 'name', type: 'text', required: true },
      { name: 'invite_code', type: 'text' },
      { name: 'owner_id', type: 'text' },
      { name: 'image_key', type: 'text' },
    ],
  },
  {
    name: 'inventory',
    fields: [
      uid,
      houseId,
      { name: 'name', type: 'text', required: true },
      { name: 'qty', type: 'number', required: true },
      { name: 'category', type: 'text' },
      { name: 'location', type: 'text' },
      { name: 'image_url', type: 'text' },
      { name: 'barcode', type: 'text' },
      { name: 'last_restocked', type: 'date' },
    ],
  },
  {
    name: 'shopping_list',
    fields: [
      uid,
      houseId,
      { name: 'inventory_id', type: 'text' },
      { name: 'name', type: 'text', required: true },
      { name: 'target_qty', type: 'number' },
      { name: 'status', type: 'text' },
    ],
  },
  {
    name: 'consumption_logs',
    fields: [
      uid,
      houseId,
      { name: 'inventory_id', type: 'text' },
      { name: 'item_name', type: 'text' },
      { name: 'qty', type: 'number' },
      { name: 'action', type: 'text' },
      { name: 'user_id', type: 'text' },
      { name: 'consumed_at', type: 'date' },
    ],
  },
  {
    name: 'house_options',
    fields: [
      uid,
      houseId,
      { name: 'type', type: 'text' },
      { name: 'name', type: 'text' },
      { name: 'icon', type: 'text' },
      { name: 'created_by', type: 'text' },
    ],
  },
  {
    name: 'pairing_codes',
    fields: [
      { name: 'code', type: 'text', required: true, max: 8 },
      houseId,
      { name: 'expires_at', type: 'date', required: true },
    ],
    // Redeemed before the joining phone has a session, so reads are open. The
    // code is the secret and it dies after ten minutes.
    rules: {
      listRule: '',
      viewRule: '',
      createRule: '@request.auth.id != ""',
      updateRule: null,
      deleteRule: '',
    },
    index: 'CREATE UNIQUE INDEX idx_pairing_codes_code ON pairing_codes (code)',
  },
];

async function api(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  // 1. Admin session.
  const auth = await api('/api/collections/_superusers/auth-with-password', {
    method: 'POST',
    body: JSON.stringify({ identity: EMAIL, password: PASSWORD }),
  });
  if (!auth.ok) {
    console.error(
      'Could not sign in as superuser. Create the first one in the PocketBase UI (/_/) first, then re-run.',
      auth.status,
      auth.body,
    );
    process.exit(1);
  }
  const token = auth.body.token;
  const headers = { Authorization: token };

  // 2. Collections, skipping any that exist.
  const existing = await api('/api/collections?perPage=200', { headers });
  const have = new Set((existing.body?.items ?? []).map(c => c.name));

  for (const collection of collections) {
    if (have.has(collection.name)) {
      console.log(`skip  ${collection.name} (exists)`);
      continue;
    }
    const created = await api('/api/collections', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: collection.name,
        type: 'base',
        // Everyone authenticated on this server sees the household's data; the
        // server is single-household by design.
        listRule: collection.rules?.listRule ?? '@request.auth.id != ""',
        viewRule: collection.rules?.viewRule ?? '@request.auth.id != ""',
        createRule: collection.rules?.createRule ?? '@request.auth.id != ""',
        updateRule: collection.rules?.updateRule ?? '@request.auth.id != ""',
        deleteRule: collection.rules?.deleteRule ?? '@request.auth.id != ""',
        fields: collection.fields,
        indexes: [collection.index ?? `CREATE UNIQUE INDEX idx_${collection.name}_uid ON ${collection.name} (uid)`],
      }),
    });
    if (!created.ok) {
      console.error(`fail  ${collection.name}`, created.status, created.body);
      process.exit(1);
    }
    console.log(`ok    ${collection.name}`);
  }

  console.log('\nCollections ready. Next: create the household user in the UI,');
  console.log('then run scripts/migrate-to-pocketbase.mjs to move the rows.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
