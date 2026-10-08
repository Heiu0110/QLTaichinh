import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { FinanceDatabase } from '../src/db/database';
import { FinanceService } from '../src/services/finance';
import { guestDatabaseName, legacyDatabase, reserveLegacy } from '../src/db/context/profiles';
import { BootstrapService } from '../src/sync/BootstrapService';
import { SyncEngine } from '../src/sync/SyncEngine';
import { FakeRemoteSyncRepository } from './FakeRemoteSyncRepository';
import { stamp } from '../src/types/models';
let storage: Map<string, string>;
const opened: FinanceDatabase[] = [];
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
});
afterEach(async () => {
  for (const db of opened.splice(0)) await db.delete();
  const name = storage.get('sotien-guest-database');
  if (name) await new FinanceDatabase(name).delete();
  vi.unstubAllGlobals();
});
const db = (cloud = false) => {
  const value = new FinanceDatabase(`profile-${crypto.randomUUID()}`, { cloud, seed: false });
  opened.push(value);
  return value;
};
test('parallel reservation retains one legacy source; guest and User B never expose User A source', async () => {
  const source = db(),
    a = db(true),
    b = db(true);
  storage.set('sotien-guest-database', source.name);
  const record = {
    ...stamp(),
    name: 'Private A source',
    type: 'cash' as const,
    currency: 'VND' as const,
    initialBalance: 0,
  };
  await new FinanceService(source).saveAccount(record);
  await Promise.all([reserveLegacy(a), reserveLegacy(a)]);
  expect((await a.syncState.get('legacySource'))?.value).toBe(source.name);
  expect(await guestDatabaseName()).not.toBe(source.name);
  await expect(
    new FinanceService(source).saveAccount({ ...record, name: 'late old tab' }, true),
  ).rejects.toThrow('giữ riêng');
  await reserveLegacy(b);
  const sourceB = await legacyDatabase(b);
  expect((await sourceB!.accounts.toArray()).some((r) => r.id === record.id)).toBe(false);
  opened.push(sourceB!);
  const remote = new FakeRemoteSyncRepository();
  remote.initialized = false;
  const bootstrap = new BootstrapService(a, new SyncEngine(a, remote));
  await bootstrap.start('upload');
  expect((await a.accounts.get(record.id))?.name).toBe('Private A source');
  expect(await source.accounts.get(record.id)).toEqual(record);
  expect(await a.syncQueue.count()).toBe(0);
  const backup = await bootstrap.exportLegacy();
  expect(backup.data.accounts).toContainEqual(record);
  expect(JSON.stringify(backup)).not.toContain('claimedBy');
});
test('reservation resumes after a crash between remembering the source and setting its owner', async () => {
  const source = db(),
    a = db(true);
  storage.set('sotien-guest-database', source.name);
  await a.syncState.put({ key: 'legacySource', value: source.name });
  await reserveLegacy(a);
  expect((await source.syncState.get('claimedBy'))?.value).toBe(a.name);
  expect(await guestDatabaseName()).not.toBe(source.name);
});
