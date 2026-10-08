import Dexie from 'dexie';
import { expect, test } from 'vitest';
import { FinanceDatabase, userDatabaseName } from '../src/db/database';
import { stamp } from '../src/types/models';
import { BackupService } from '../src/services/backup/backup';
test('real v1 schema upgrade preserves IDs, records and backup whitelist', async () => {
  const name = `migration-${crypto.randomUUID()}`;
  const old = new Dexie(name);
  old.version(1).stores({
    accounts: 'id, type, updatedAt',
    transactions: 'id, accountId, toAccountId, categoryId, date, type, updatedAt',
    categories: 'id, type, updatedAt',
    budgets: 'id, month, categoryId, updatedAt',
    savingsGoals: 'id, updatedAt',
    settings: 'id, &key, updatedAt',
  });
  const account = {
    ...stamp(),
    name: 'Old cash',
    type: 'cash',
    initialBalance: 10,
    currency: 'VND',
  };
  await old.table('accounts').add(account);
  old.close();
  const db = new FinanceDatabase(name);
  try {
    expect(await db.accounts.get(account.id)).toEqual(account);
    expect(await db.syncQueue.count()).toBe(0);
    await db.syncState.put({ key: 'private-sync-state', value: 'excluded' });
    const service = new BackupService(db);
    const backup = await service.export();
    expect(Object.keys(backup.data)).toHaveLength(6);
    expect(JSON.stringify(backup)).not.toContain('private-sync-state');
    await service.replace(backup);
    expect(await db.syncState.get('private-sync-state')).toBeDefined();
  } finally {
    await db.delete();
  }
});
test('user databases are isolated, unseeded and cannot full-restore even while sync is paused', async () => {
  const a = new FinanceDatabase(userDatabaseName('https://fixture.invalid', crypto.randomUUID()), {
    cloud: true,
  });
  const b = new FinanceDatabase(userDatabaseName('https://fixture.invalid', crypto.randomUUID()), {
    cloud: true,
  });
  try {
    await a.accounts.add({
      ...stamp(),
      name: 'A',
      type: 'cash',
      initialBalance: 0,
      currency: 'VND',
    });
    expect(await b.accounts.count()).toBe(0);
    expect(await b.categories.count()).toBe(0);
    await expect(new BackupService(a).replace({})).rejects.toThrow('hồ sơ cloud');
  } finally {
    await a.delete();
    await b.delete();
  }
});
