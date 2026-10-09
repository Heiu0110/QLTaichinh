import { afterEach, expect, test } from 'vitest';
import { FinanceDatabase } from '../src/db/database';
import { FinanceService } from '../src/services/finance';
import { BackupService, validateBackup } from '../src/services/backup/backup';
import { accountChoices } from '../src/utils/bankAccounts';
import { stamp, type Transaction } from '../src/types/models';
const databases: FinanceDatabase[] = [];
async function setup() {
  const db = new FinanceDatabase(`banks-${crypto.randomUUID()}`, { cloud: true, seed: false });
  databases.push(db);
  await db.syncState.put({ key: 'ready', value: 'true' });
  return { db, service: new FinanceService(db) };
}
afterEach(async () => {
  for (const db of databases.splice(0)) await db.delete();
});
const entry = (data: Partial<Transaction> = {}): Transaction => ({
  ...stamp(),
  type: 'expense',
  amount: 50000,
  accountId: 'bank:mb',
  date: '2026-10-09',
  ...data,
});

test('concurrent preset saves create one account and queue the parent before both transactions', async () => {
  const { db, service } = await setup();
  await Promise.all([
    service.saveTransactionWithAccountChoices(entry()),
    service.saveTransactionWithAccountChoices(entry()),
  ]);
  const accounts = await db.accounts.toArray();
  expect(accounts).toHaveLength(1);
  expect(accounts[0]).toMatchObject({ name: 'MB Bank', type: 'bank', initialBalance: 0 });
  expect((await db.transactions.toArray()).every((t) => t.accountId === accounts[0].id)).toBe(true);
  expect((await db.syncQueue.orderBy('localOrder').toArray()).map((m) => m.entityType)).toEqual([
    'accounts',
    'transactions',
    'transactions',
  ]);
  expect(validateBackup(await new BackupService(db).export()).data.accounts).toHaveLength(1);
});

test('invalid transfer rolls back new banks, transactions and outbox together', async () => {
  const { db, service } = await setup();
  for (const data of [
    entry({ type: 'transfer', toAccountId: 'bank:mb' }),
    entry({ type: 'transfer', toAccountId: 'bank:sacom', amount: 0 }),
  ]) {
    await expect(service.saveTransactionWithAccountChoices(data)).rejects.toThrow();
    expect(await db.accounts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
    expect(await db.syncQueue.count()).toBe(0);
  }
});

test('reuses an existing bank without changing its ID, opening balance or metadata', async () => {
  const { db, service } = await setup();
  const bank = {
    ...stamp(),
    name: 'MBBank',
    type: 'bank' as const,
    initialBalance: 300000,
    currency: 'VND' as const,
  };
  await service.saveAccount(bank);
  const tx = entry({ type: 'transfer', toAccountId: 'bank:vietin' });
  await service.saveTransactionWithAccountChoices(tx);
  expect(await db.accounts.get(bank.id)).toEqual(bank);
  expect((await db.transactions.get(tx.id))?.accountId).toBe(bank.id);
  const choices = accountChoices(await service.accounts.getAll());
  expect(choices.find((c) => c.name === 'MBBank')?.id).toBe(bank.id);
  expect(choices.some((c) => c.id === 'bank:mb')).toBe(false);
});

test('does not revive deleted banks or guess between duplicate existing accounts', async () => {
  const { db, service } = await setup();
  const deleted = {
    ...stamp(),
    name: 'MB Bank',
    type: 'bank' as const,
    initialBalance: 250000,
    currency: 'VND' as const,
    deletedAt: new Date().toISOString(),
  };
  await service.saveAccount(deleted);
  await service.saveTransactionWithAccountChoices(entry());
  expect(await db.accounts.get(deleted.id)).toEqual(deleted);
  const active = await service.accounts.getAll();
  expect(active).toHaveLength(1);
  expect(active[0].id).not.toBe(deleted.id);
  await service.saveAccount({ ...active[0], ...stamp() });
  await expect(service.saveTransactionWithAccountChoices(entry())).rejects.toThrow(
    'Có nhiều tài khoản',
  );
  expect(await db.transactions.count()).toBe(1);
  expect(
    accountChoices(await service.accounts.getAll()).filter((c) => c.name === 'MB Bank'),
  ).toHaveLength(2);
});
