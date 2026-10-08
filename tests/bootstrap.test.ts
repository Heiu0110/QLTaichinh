import { expect, test } from 'vitest';
import { FinanceDatabase } from '../src/db/database';
import { BootstrapService } from '../src/sync/BootstrapService';
import { SyncEngine } from '../src/sync/SyncEngine';
import { FakeRemoteSyncRepository } from './FakeRemoteSyncRepository';
test('initial download is paginated and does not enqueue seed duplicates', async () => {
  const remote = new FakeRemoteSyncRepository();
  const now = new Date().toISOString();
  for (let i = 0; i < 205; i++)
    await remote.pushMutation({
      mutationId: crypto.randomUUID(),
      entityType: 'accounts',
      entityId: `${i}`,
      payload: {
        id: crypto.randomUUID(),
        name: `Cash ${i}`,
        type: 'cash',
        currency: 'VND',
        initialBalance: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
      baseVersion: null,
      status: 'attempted',
      localOrder: i,
      attempts: 1,
      nextAttemptAt: 0,
    });
  const db = new FinanceDatabase(`bootstrap-${crypto.randomUUID()}`, { cloud: true });
  try {
    await new BootstrapService(db, new SyncEngine(db, remote)).start('download');
    expect(await db.accounts.count()).toBe(205);
    expect(await db.syncQueue.count()).toBe(0);
    expect((await db.syncState.get('ready'))?.value).toBe('true');
    expect((await db.syncState.get('cursor'))?.value).toBe('205');
  } finally {
    await db.delete();
  }
});
test('empty cloud requires explicit initialization and an interrupted bootstrap is not writable', async () => {
  const remote = new FakeRemoteSyncRepository();
  remote.initialized = false;
  const db = new FinanceDatabase(`bootstrap-${crypto.randomUUID()}`, { cloud: true });
  try {
    await expect(db.assertWritable()).rejects.toThrow('thiết lập');
    await new BootstrapService(db, new SyncEngine(db, remote)).start('empty');
    expect(remote.initialized).toBe(true);
    await expect(db.assertWritable()).resolves.toBeUndefined();
  } finally {
    await db.delete();
  }
});
