import pg from 'pg';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const url = process.env.TEST_DATABASE_URL ?? 'postgres://postgres@127.0.0.1:54329/postgres';
if (!['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
  throw new Error('Tests require an isolated local PostgreSQL database.');
const root = new pg.Client({ connectionString: url });
await root.connect();
const testDatabase = `sotien_test_${randomUUID().replaceAll('-', '')}`;
const migrator = `sotien_migrator_${randomUUID().replaceAll('-', '')}`;
await root.query(`create role ${migrator} nologin createrole nosuperuser nobypassrls`);
// A role creator has ADMIN OPTION on its new role. Reproduce that when this
// shared local cluster already has the writer role from an earlier fixture run.
if ((await root.query("select 1 from pg_roles where rolname='sotien_writer'")).rowCount)
  await root.query(`grant sotien_writer to ${migrator} with admin option`);
await root.query(`create database ${testDatabase} owner ${migrator}`);
const testUrl = new URL(url);
testUrl.pathname = `/${testDatabase}`;
const admin = new pg.Client({ connectionString: testUrl.toString() });
await admin.connect();
await admin.query(`set role ${migrator}`);
await admin.query(await readFile(new URL('./bootstrap.sql', import.meta.url), 'utf8'));
await admin.query(
  await readFile(new URL('../../supabase/migrations/202610080001_v2.sql', import.meta.url), 'utf8'),
);
assert.equal(
  (await admin.query('select rolsuper from pg_roles where rolname=current_user')).rows[0].rolsuper,
  false,
);
assert.equal(
  (await admin.query("select has_schema_privilege('sotien_writer','public','CREATE') allowed"))
    .rows[0].allowed,
  false,
);
assert.equal(
  (
    await admin.query(
      "select count(*)::int count from pg_tables where schemaname='public' and tableowner='sotien_writer'",
    )
  ).rows[0].count,
  0,
);
const a = randomUUID(),
  b = randomUUID();
await admin.query('insert into auth.users values($1),($2)', [a, b]);
async function client(id) {
  const c = new pg.Client({ connectionString: testUrl.toString() });
  await c.connect();
  await c.query('set role authenticated');
  await c.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  return c;
}
const A = await client(a),
  B = await client(b),
  A2 = await client(a);
const now = new Date().toISOString();
const account = {
  id: randomUUID(),
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  name: 'Fixture',
  type: 'cash',
  currency: 'VND',
  initialBalance: 0,
};
const push = async (c, p, base = null, id = randomUUID(), kind = 'accounts') =>
  (await c.query('select sync_push($1,$2,$3,$4) result', [id, kind, p, base])).rows[0].result;
const pull = async (c, cursor = '0', limit = 200, upper = null) =>
  (await c.query('select sync_pull($1,$2,$3) result', [cursor, limit, upper])).rows[0].result;
try {
  for (const c of [A, B]) await c.query('select sync_initialize($1,0)', [randomUUID()]);
  const mutation = randomUUID(),
    first = await push(A, account, null, mutation);
  assert.equal(first.status, 'applied');
  assert.equal(first.version, '1');
  assert.deepEqual(await push(A, account, null, mutation), first); // lost ACK
  await assert.rejects(push(A, { ...account, name: 'changed' }, null, mutation));
  assert.equal((await B.query('select * from accounts')).rowCount, 0);
  await assert.rejects(B.query('update accounts set deleted_at=now() where user_id=$1', [a]));
  await assert.rejects(
    B.query(
      'insert into accounts(user_id,id,payload,created_at,updated_at,sync_version) values($1,$2,$3,now(),now(),1)',
      [a, account.id, account],
    ),
  );
  assert.equal((await pull(B)).changes.length, 0);
  const txn = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    type: 'expense',
    amount: 10,
    accountId: account.id,
    date: '2026-10-08',
  };
  assert.equal((await push(B, txn, null, randomUUID(), 'transactions')).status, 'invalid');
  assert.equal(
    (await push(A, { ...account, id: randomUUID(), initialBalance: 0.5 })).status,
    'invalid',
  );
  assert.equal(
    (await push(A, { ...account, id: randomUUID(), currency: 'USD' })).status,
    'invalid',
  );
  assert.equal((await push(A, account)).status, 'conflict');
  const concurrent = await Promise.all([
    push(A, { ...account, name: 'one' }, '1'),
    push(A2, { ...account, name: 'two' }, '1'),
  ]);
  assert.deepEqual(concurrent.map((r) => r.status).sort(), ['applied', 'conflict']);
  const current = concurrent.find((r) => r.status === 'applied');
  assert.equal((await push(A, txn, null, randomUUID(), 'transactions')).status, 'applied');
  assert.equal(
    (await push(A, { ...current.payload, deletedAt: now }, current.version)).status,
    'invalid',
  );
  const pages = [];
  let cursor = '0',
    upper = null;
  do {
    const page = await pull(A, cursor, 1, upper);
    upper = page.upperBound;
    pages.push(...page.changes);
    cursor = page.cursor;
  } while (cursor !== upper);
  assert.equal(pages.length, 3);
  assert.deepEqual(
    pages.map((r) => r.version),
    ['1', '2', '3'],
  );
  // A held revision transaction must block the next write; pulling cannot jump the uncommitted gap.
  await A.query('begin');
  const held = await push(A, { ...account, id: randomUUID() });
  let completed = false;
  const next = push(A2, { ...account, id: randomUUID() }).then((r) => {
    completed = true;
    return r;
  });
  await new Promise((r) => setTimeout(r, 100));
  assert.equal(completed, false);
  const reader = await client(a);
  assert.equal((await pull(reader)).upperBound, '3');
  await reader.end();
  await A.query('commit');
  await next;
  assert.equal(held.version, '4');

  // Typed fields, calendar dates, transfer semantics and budget uniqueness.
  const category = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    name: 'Food',
    type: 'expense',
  };
  assert.equal((await push(A, category, null, randomUUID(), 'categories')).status, 'applied');
  for (const bad of [
    { ...txn, id: randomUUID(), amount: 1.2 },
    { ...txn, id: randomUUID(), amount: 0 },
    { ...txn, id: randomUUID(), date: '2026-02-30' },
    { ...txn, id: randomUUID(), type: 'transfer', toAccountId: account.id },
    { ...txn, id: randomUUID(), type: 'income', categoryId: category.id },
  ])
    assert.equal((await push(A, bad, null, randomUUID(), 'transactions')).status, 'invalid');
  const budget = {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    amount: 100,
    period: 'monthly',
    month: '2026-10',
    categoryId: category.id,
  };
  assert.equal((await push(A, budget, null, randomUUID(), 'budgets')).status, 'applied');
  assert.equal(
    (await push(A, { ...budget, id: randomUUID() }, null, randomUUID(), 'budgets')).status,
    'invalid',
  );
  assert.equal(
    (await push(A, { ...category, type: 'income' }, '6', randomUUID(), 'categories')).status,
    'invalid',
  );
  // NULL budgets and a real nil-UUID category must not share a sentinel key.
  const nilCategory = { ...category, id: '00000000-0000-0000-0000-000000000000' };
  const nilResult = await push(A, nilCategory, null, randomUUID(), 'categories');
  assert.equal(nilResult.status, 'applied');
  const totalBudget = { ...budget, id: randomUUID() };
  delete totalBudget.categoryId;
  assert.equal((await push(A, totalBudget, null, randomUUID(), 'budgets')).status, 'applied');
  assert.equal(
    (
      await push(
        A,
        { ...budget, id: randomUUID(), categoryId: nilCategory.id },
        null,
        randomUUID(),
        'budgets',
      )
    ).status,
    'applied',
  );
  const historyCategory = { ...category, id: randomUUID() };
  const historyVersion = (await push(A, historyCategory, null, randomUUID(), 'categories')).version;
  assert.equal(
    (
      await push(
        A,
        { ...txn, id: randomUUID(), categoryId: historyCategory.id, deletedAt: now },
        null,
        randomUUID(),
        'transactions',
      )
    ).status,
    'applied',
  );
  assert.equal(
    (
      await push(
        A,
        { ...historyCategory, type: 'income', deletedAt: now },
        historyVersion,
        randomUUID(),
        'categories',
      )
    ).status,
    'invalid',
  );
  // Anonymous callers cannot execute sync or read financial tables.
  const anon = new pg.Client({ connectionString: testUrl.toString() });
  await anon.connect();
  await anon.query('set role anon');
  await assert.rejects(anon.query('select sync_pull()'));
  await assert.rejects(anon.query('select * from accounts'));
  await anon.end();
  // Bootstrap batches are immutable/idempotent, invisible before atomic publication.
  const u = randomUUID();
  await admin.query('insert into auth.users values($1)', [u]);
  const C = await client(u),
    C2 = await client(u);
  const boot = randomUUID();
  const staged = { ...account, id: randomUUID() };
  const batch = [{ entityType: 'accounts', payload: staged }];
  await C.query('select sync_stage($1,$2)', [boot, JSON.stringify(batch)]);
  await C.query('select sync_stage($1,$2)', [boot, JSON.stringify(batch)]);
  assert.equal((await pull(C)).initialized, false);
  assert.equal((await C.query('select * from accounts')).rowCount, 0);
  await assert.rejects(
    C.query('select sync_stage($1,$2)', [
      boot,
      JSON.stringify([{ entityType: 'accounts', payload: { ...staged, name: 'changed' } }]),
    ]),
  );
  await assert.rejects(C.query('select sync_initialize($1,2)', [boot]));
  assert.equal((await pull(C)).initialized, false);
  await C.query('select sync_initialize($1,1)', [boot]);
  await C.query('select sync_initialize($1,1)', [boot]);
  assert.equal((await pull(C)).changes.length, 1);
  await assert.rejects(C2.query('select sync_initialize($1,0)', [randomUUID()]));
  assert.equal((await pull(C2)).changes[0].payload.id, staged.id);
  await C.end();
  await C2.end();
  console.log(
    'PostgreSQL: ownership, RLS, validation, CAS, idempotency, pagination, commit order passed.',
  );
} finally {
  await Promise.allSettled([A.end(), B.end(), A2.end()]);
  await admin.end();
  await root.query(`drop database ${testDatabase} with (force)`);
  await root.query(`drop role ${migrator}`);
  await root.end();
}
