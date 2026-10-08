import { afterEach, expect, test } from 'vitest';
import { FinanceDatabase } from '../src/db/database';
import { FinanceService } from '../src/services/finance';
import { stamp } from '../src/types/models';
const databases: FinanceDatabase[] = [];
async function setup(cloud = true) {
  const db = new FinanceDatabase(`outbox-${crypto.randomUUID()}`, { cloud, seed: false });
  databases.push(db);
  await db.syncState.put({ key: 'ready', value: 'true' });
  return { db, service: new FinanceService(db) };
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
test('domain and queue roll back together on failure', async () => {
  const { db, service } = await setup();
  const a = account();
  await expect(
    db.transaction('rw', db.tables, async () => {
      await service.saveAccount(a);
      throw Error('abort');
    }),
  ).rejects.toThrow('abort');
  expect(await db.accounts.count()).toBe(0);
  expect(await db.syncQueue.count()).toBe(0);
});
test('coalesces only never-attempted mutations; freezes retries and chains edits made in flight', async () => {
  const { db, service } = await setup();
  const a = account();
  await service.saveAccount(a);
  await service.saveAccount({ ...a, name: 'second' }, true);
  const first = (await db.syncQueue.toArray())[0];
  expect(first.payload).toMatchObject({ name: 'second' });
  expect(await db.syncQueue.count()).toBe(1);
  await db.syncQueue.update(first.mutationId, { status: 'attempted' });
  await service.saveAccount({ ...a, name: 'third' }, true);
  await service.saveAccount({ ...a, name: 'fourth' }, true);
  const rows = await db.syncQueue.orderBy('localOrder').toArray();
  expect(rows).toHaveLength(2);
  expect(rows[0].payload).toEqual(first.payload);
  expect(rows[1]).toMatchObject({
    dependsOnMutationId: first.mutationId,
    payload: { name: 'fourth' },
  });
  await service.removeAccount(a.id);
  expect((await db.syncQueue.orderBy('localOrder').last())?.payload.deletedAt).toBeTruthy();
});
test('guest writes never enqueue; category type cannot invalidate historical references', async () => {
  const { db, service } = await setup(false);
  const a = account(),
    c = { ...stamp(), name: 'Food', type: 'expense' as const };
  await service.saveAccount(a);
  await service.saveCategory(c);
  await service.saveTransaction({
    ...stamp(),
    accountId: a.id,
    categoryId: c.id,
    type: 'expense',
    amount: 100,
    date: '2026-10-08',
  });
  await expect(service.saveCategory({ ...c, type: 'income' }, true)).rejects.toThrow(
    'đã được sử dụng',
  );
  expect(await db.syncQueue.count()).toBe(0);
});
test('retired services reject late callbacks instead of reopening another profile', async () => {
  const { db, service } = await setup();
  db.retire();
  await expect(service.saveAccount(account())).rejects.toBeDefined();
});
test('an open editor cannot overwrite a record changed by a pull, even with identical timestamps', async () => {
  const { db, service } = await setup();
  const a = account();
  await service.saveAccount(a);
  await db.syncQueue.clear();
  await db.accounts.put({ ...a, name: 'new remote name' });
  await expect(service.saveAccount({ ...a, name: 'stale form edit' }, true, a)).rejects.toThrow(
    'đang mở form',
  );
  expect(await db.accounts.get(a.id)).toMatchObject({ name: 'new remote name' });
  expect(await db.syncQueue.count()).toBe(0);
});
