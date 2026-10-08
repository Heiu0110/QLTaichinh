import { afterEach, expect, test } from 'vitest';
import { FinanceDatabase } from '../src/db/database';
import { FinanceService } from '../src/services/finance';
import { SyncEngine } from '../src/sync/SyncEngine';
import { FakeRemoteSyncRepository } from './FakeRemoteSyncRepository';
import { stamp } from '../src/types/models';
const databases: FinanceDatabase[] = [];
async function device(remote: FakeRemoteSyncRepository) {
  const db = new FinanceDatabase(`sync-${crypto.randomUUID()}`, { cloud: true });
  databases.push(db);
  await db.syncState.put({ key: 'ready', value: 'true' });
  return { db, service: new FinanceService(db), engine: new SyncEngine(db, remote) };
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});
const account = () => ({
  ...stamp(),
  name: 'Cash',
  type: 'cash' as const,
  currency: 'VND' as const,
  initialBalance: 0,
});
test('A/B/C: two devices, offline durable write and soft-delete propagation without outgoing loops', async () => {
  const remote = new FakeRemoteSyncRepository(),
    a = await device(remote),
    b = await device(remote);
  const cash = account();
  await a.service.saveAccount(cash);
  await a.engine.sync();
  await b.engine.sync();
  const tx = {
    ...stamp(),
    type: 'expense' as const,
    amount: 40000,
    accountId: cash.id,
    date: '2026-10-08',
  };
  await b.service.saveTransaction(tx);
  b.db.close();
  await b.db.open();
  expect(await b.service.transactions.getById(tx.id)).toEqual(tx);
  expect(await b.db.syncQueue.count()).toBe(1);
  await b.engine.sync();
  await a.engine.sync();
  expect(await a.service.transactions.getById(tx.id)).toEqual(tx);
  expect(await a.db.syncQueue.count()).toBe(0);
  await a.service.transactions.remove(tx.id);
  await a.engine.sync();
  await b.engine.sync();
  expect(await b.service.transactions.getById(tx.id)).toBeUndefined();
  expect((await b.db.transactions.get(tx.id))?.deletedAt).toBeTruthy();
  expect(await b.db.syncQueue.count()).toBe(0);
});
test('D: competing updates preserve both versions; keep local uses latest CAS and can conflict again', async () => {
  const remote = new FakeRemoteSyncRepository(),
    a = await device(remote),
    b = await device(remote);
  const cash = account();
  await a.service.saveAccount(cash);
  await a.engine.sync();
  await b.engine.sync();
  await a.service.saveAccount({ ...cash, name: 'PC' }, true);
  await b.service.saveAccount(
    { ...cash, name: 'Phone', updatedAt: '2099-01-01T00:00:00.000Z' },
    true,
  );
  await a.engine.sync();
  await b.engine.sync();
  let conflict = (await b.db.syncConflicts.toArray())[0];
  expect(conflict.localData).toMatchObject({ name: 'Phone' });
  expect(conflict.remoteData).toMatchObject({ name: 'PC' });
  await b.engine.resolve(conflict.id, 'local');
  await a.service.saveAccount({ ...cash, name: 'PC again' }, true);
  await a.engine.sync();
  await b.engine.sync();
  expect(await b.db.syncConflicts.count()).toBe(1);
  conflict = (await b.db.syncConflicts.toArray())[0];
  await b.engine.resolve(conflict.id, 'cloud');
  expect(await b.db.syncQueue.count()).toBe(0);
  expect(await b.service.accounts.getById(cash.id)).toMatchObject({ name: 'PC again' });
});
test('E: applied mutation with lost ACK retries same ID and does not duplicate or falsely conflict', async () => {
  const remote = new FakeRemoteSyncRepository(),
    a = await device(remote);
  const cash = account();
  await a.service.saveAccount(cash);
  remote.loseAck = true;
  await expect(a.engine.sync()).rejects.toThrow('lost ACK');
  expect(await a.db.syncQueue.count()).toBe(1);
  await a.engine.sync();
  expect(remote.changes).toHaveLength(1);
  expect(await a.db.syncConflicts.count()).toBe(0);
  expect(await a.db.syncQueue.count()).toBe(0);
});
test('edits during in-flight ACK survive and successor receives acknowledged base version', async () => {
  const remote = new FakeRemoteSyncRepository(),
    a = await device(remote);
  const cash = account();
  await a.service.saveAccount(cash);
  remote.beforeReply = async () => {
    await a.service.saveAccount({ ...cash, name: 'edited in flight' }, true);
  };
  await a.engine.sync();
  expect(await a.service.accounts.getById(cash.id)).toMatchObject({ name: 'edited in flight' });
  const next = (await a.db.syncQueue.toArray())[0];
  expect(next.baseVersion).toBe('1');
  expect(next.dependsOnMutationId).toBeUndefined();
  await a.engine.sync();
  expect(remote.changes.at(-1)?.payload).toMatchObject({ name: 'edited in flight' });
});
test('pull pages are atomic with cursor; duplicate page application is harmless', async () => {
  const remote = new FakeRemoteSyncRepository(),
    a = await device(remote),
    b = await device(remote);
  await a.service.saveAccount(account());
  await a.engine.sync();
  const page = await remote.pullChanges('0', 1);
  await b.engine.applyPage(page.changes, page.cursor, '0');
  await b.engine.applyPage(page.changes, page.cursor, '0');
  expect(await b.db.accounts.count()).toBe(1);
  expect(await b.db.syncQueue.count()).toBe(0);
  const broken = {
    ...page.changes[0],
    payload: { ...page.changes[0].payload, id: crypto.randomUUID() },
    version: '2',
  };
  await expect(
    b.db.transaction('rw', b.db.tables, async () => {
      await b.engine.applyPage([broken], '2', '1');
      throw Error('abort');
    }),
  ).rejects.toThrow();
  expect((await b.db.syncState.get('cursor'))?.value).toBe('1');
  expect(await b.db.accounts.count()).toBe(1);
});
test('parent deletion versus offline child cannot orphan local data; keep-cloud is guarded', async () => {
  const remote = new FakeRemoteSyncRepository(),
    a = await device(remote),
    b = await device(remote);
  const cash = account();
  await a.service.saveAccount(cash);
  await a.engine.sync();
  await b.engine.sync();
  await b.service.saveTransaction({
    ...stamp(),
    type: 'expense',
    amount: 10,
    accountId: cash.id,
    date: '2026-10-08',
  });
  await a.service.removeAccount(cash.id);
  await a.engine.sync();
  await b.engine.sync();
  const conflict = await b.db.syncConflicts.get(`accounts:${cash.id}`);
  expect(conflict?.reason).toBe('reference');
  expect(await b.service.accounts.getById(cash.id)).toBeDefined();
  await expect(b.engine.resolve(conflict!.id, 'cloud')).rejects.toThrow('tham chiếu');
  expect(await b.service.transactions.getAll()).toHaveLength(1);
});
test('cancellation never applies a late response to a closed profile', async () => {
  const remote = new FakeRemoteSyncRepository(),
    a = await device(remote);
  await a.service.saveAccount(account());
  const stop = new AbortController();
  remote.beforeReply = async () => stop.abort();
  await expect(a.engine.sync(stop.signal)).rejects.toThrow('Stopped');
  expect(await a.db.syncQueue.count()).toBe(1);
});
test('a concurrent tab can acknowledge its own mutation through pull before the push response arrives', async () => {
  const remote = new FakeRemoteSyncRepository(),
    a = await device(remote);
  const cash = account();
  await a.service.saveAccount(cash);
  const queued = (await a.db.syncQueue.toArray())[0];
  await a.db.syncQueue.update(queued.mutationId, { status: 'attempted' });
  await remote.pushMutation(queued);
  await a.engine.pull();
  expect(await a.db.syncQueue.count()).toBe(0);
  expect(await a.db.syncConflicts.count()).toBe(0);
  await a.engine.accept(queued, { status: 'applied', payload: cash, version: '1' });
  expect(await a.db.accounts.count()).toBe(1);
});
