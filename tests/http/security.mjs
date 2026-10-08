// Disposable real PostgREST + PostgreSQL integration. No cloud credentials/data.
// JWTs are signed test identities, not a substitute for GoTrue/SMTP/iOS validation.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const suffix = randomUUID().replaceAll('-', '');
const network = `sotien-http-${suffix}`;
const database = `${network}-db`,
  api = `${network}-api`;
const secret = randomBytes(32).toString('hex');
const created = [];
let networkCreated = false,
  admin;
const docker = (...args) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 120000,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const publishedPort = (name, port) => Number(docker('port', name, `${port}/tcp`).split(':').at(-1));
async function waitFor(check) {
  let last;
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      return await check();
    } catch (error) {
      last = error;
      await delay(250);
    }
  }
  throw last;
}
const jwt = (id, expiry = 3600) => {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const body = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: id, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + expiry })}`;
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
};
try {
  docker('network', 'create', network);
  networkCreated = true;
  docker(
    'run',
    '-d',
    '--rm',
    '--name',
    database,
    '--network',
    network,
    '-e',
    'POSTGRES_HOST_AUTH_METHOD=trust',
    '-p',
    '127.0.0.1::5432',
    'postgres:17',
  );
  created.push(database);
  const port = publishedPort(database, 5432);
  admin = await waitFor(async () => {
    const client = new pg.Client({
      host: '127.0.0.1',
      port,
      user: 'postgres',
      database: 'postgres',
      connectionTimeoutMillis: 1000,
    });
    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.end();
      throw error;
    }
  });
  await admin.query(await readFile(new URL('../sql/bootstrap.sql', import.meta.url), 'utf8'));
  // PostgREST supplies JSON claims, whereas direct SQL tests set the legacy sub GUC.
  await admin.query(`
    create or replace function auth.uid() returns uuid language sql stable as $$
      select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid
    $$;
  `);
  await admin.query(
    await readFile(
      new URL('../../supabase/migrations/202610080001_v2.sql', import.meta.url),
      'utf8',
    ),
  );
  await admin.query(
    'create role authenticator login noinherit; grant anon, authenticated to authenticator',
  );
  const a = randomUUID(),
    b = randomUUID(),
    c = randomUUID();
  await admin.query('insert into auth.users values ($1),($2),($3)', [a, b, c]);
  docker(
    'run',
    '-d',
    '--rm',
    '--name',
    api,
    '--network',
    network,
    '-p',
    '127.0.0.1::3000',
    '-e',
    `PGRST_DB_URI=postgres://authenticator@${database}:5432/postgres`,
    '-e',
    'PGRST_DB_ANON_ROLE=anon',
    '-e',
    `PGRST_JWT_SECRET=${secret}`,
    'postgrest/postgrest:v12.2.3',
  );
  created.push(api);
  const origin = `http://127.0.0.1:${publishedPort(api, 3000)}`;
  async function request(token, path, method = 'GET', body) {
    const response = await fetch(`${origin}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(5000),
    });
    const text = await response.text();
    return { status: response.status, data: text ? JSON.parse(text) : null };
  }
  const tokens = new Map([a, b, c].map((id) => [id, jwt(id)]));
  async function rpc(id, name, args = {}) {
    const result = await request(tokens.get(id), `/rpc/${name}`, 'POST', args);
    assert.ok(result.status >= 200 && result.status < 300, `${name}: ${JSON.stringify(result)}`);
    return result.data;
  }
  await waitFor(() => rpc(a, 'sync_pull'));
  assert.equal((await request(undefined, '/rpc/sync_pull', 'POST', {})).status, 401);
  assert.equal((await request(jwt(a, -120), '/rpc/sync_pull', 'POST', {})).status, 401);
  assert.equal((await request(`${jwt(a)}invalid`, '/rpc/sync_pull', 'POST', {})).status, 401);
  for (const id of [a, b])
    await rpc(id, 'sync_initialize', { bootstrap_id: randomUUID(), expected_count: 0 });
  const now = new Date().toISOString();
  const account = {
    id: randomUUID(),
    name: 'HTTP fixture',
    type: 'cash',
    currency: 'VND',
    initialBalance: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  const mutation = {
    mutation_id: randomUUID(),
    entity_type: 'accounts',
    payload: account,
    base_version: null,
  };
  const first = await rpc(a, 'sync_push', mutation);
  assert.equal(first.status, 'applied');
  assert.equal(first.version, '1');
  assert.deepEqual(await rpc(a, 'sync_push', mutation), first);
  assert.equal(
    (
      await request(tokens.get(a), '/rpc/sync_push', 'POST', {
        ...mutation,
        payload: { ...account, name: 'changed replay' },
      })
    ).status,
    400,
  );
  assert.equal((await request(tokens.get(a), '/accounts?select=id')).data.length, 1);
  assert.deepEqual((await request(tokens.get(b), '/accounts?select=id')).data, []);
  assert.equal(
    (await request(tokens.get(b), `/accounts?user_id=eq.${a}`, 'PATCH', { deleted_at: now }))
      .status,
    403,
  );
  assert.equal((await rpc(b, 'sync_pull')).changes.length, 0);
  const concurrent = await Promise.all(
    ['desktop', 'phone'].map((name) =>
      rpc(a, 'sync_push', {
        ...mutation,
        mutation_id: randomUUID(),
        payload: { ...account, name },
        base_version: '1',
      }),
    ),
  );
  assert.deepEqual(concurrent.map((r) => r.status).sort(), ['applied', 'conflict']);
  const winner = concurrent.find((r) => r.status === 'applied');
  const removed = await rpc(a, 'sync_push', {
    ...mutation,
    mutation_id: randomUUID(),
    base_version: winner.version,
    payload: { ...winner.payload, deletedAt: now },
  });
  assert.equal(removed.status, 'applied');
  const page1 = await rpc(a, 'sync_pull', { after_version: '0', page_limit: 1, upper_bound: null });
  assert.equal(page1.cursor, '1');
  assert.equal(page1.upperBound, '3');
  const page2 = await rpc(a, 'sync_pull', {
    after_version: page1.cursor,
    page_limit: 2,
    upper_bound: page1.upperBound,
  });
  assert.equal(page2.cursor, '3');
  assert.equal(page2.changes.at(-1).payload.deletedAt, now);
  const invalid = await rpc(b, 'sync_push', {
    mutation_id: randomUUID(),
    entity_type: 'transactions',
    base_version: null,
    payload: {
      id: randomUUID(),
      type: 'expense',
      amount: 10000,
      accountId: account.id,
      date: '2026-10-08',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  });
  assert.equal(invalid.status, 'invalid');
  const bootstrap = {
    bootstrap_id: randomUUID(),
    records: [{ entityType: 'accounts', payload: { ...account, id: randomUUID() } }],
  };
  await rpc(c, 'sync_stage', bootstrap);
  await rpc(c, 'sync_stage', bootstrap);
  assert.equal((await rpc(c, 'sync_pull')).initialized, false);
  assert.deepEqual((await request(tokens.get(c), '/accounts?select=id')).data, []);
  await rpc(c, 'sync_initialize', { bootstrap_id: bootstrap.bootstrap_id, expected_count: 1 });
  await rpc(c, 'sync_initialize', { bootstrap_id: bootstrap.bootstrap_id, expected_count: 1 });
  const published = await rpc(c, 'sync_pull');
  assert.equal(published.initialized, true);
  assert.equal(published.changes.length, 1);
  console.log(
    'Real HTTP integration passed: signed/expired/invalid JWT, RLS isolation, direct-write denial, named RPC arguments, CAS conflict, idempotency, soft delete, pagination, cross-user FK and atomic bootstrap.',
  );
} finally {
  await admin?.end();
  for (const name of created.reverse()) docker('rm', '-f', name);
  if (networkCreated) docker('network', 'rm', network);
}
