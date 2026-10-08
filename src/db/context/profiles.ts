import { FinanceDatabase } from '../database';
const guestKey = 'sotien-guest-database';
export async function guestDatabaseName(): Promise<string> {
  let name = localStorage.getItem(guestKey) ?? 'sotien-v1';
  const db = new FinanceDatabase(name);
  try {
    if (await db.syncState.get('claimedBy')) {
      name = `sotien-local-${crypto.randomUUID()}`;
      localStorage.setItem(guestKey, name);
    }
  } finally {
    db.close();
  }
  return name;
}
// Mark the legacy source before rotating guest context. A crash can retain the source,
// but can never expose it as a new guest database after it has an owner.
export async function reserveLegacy(target: FinanceDatabase) {
  const candidate =
    (await target.syncState.get('legacySource'))?.value ?? (await guestDatabaseName());
  const name = await target.transaction('rw', target.syncState, async () => {
    const existing = (await target.syncState.get('legacySource'))?.value;
    if (existing) return existing;
    await target.syncState.put({ key: 'legacySource', value: candidate });
    return candidate;
  });
  const source = new FinanceDatabase(name);
  try {
    const claimed = await source.transaction('rw', source.tables, async () => {
      const owner = (await source.syncState.get('claimedBy'))?.value;
      if (owner && owner !== target.name) return false;
      await source.syncState.put({ key: 'claimedBy', value: target.name });
      return true;
    });
    if (!claimed) {
      await target.syncState.delete('legacySource');
      return;
    }
    if ((localStorage.getItem(guestKey) ?? 'sotien-v1') === name)
      localStorage.setItem(guestKey, `sotien-local-${crypto.randomUUID()}`);
  } finally {
    source.close();
  }
}
export async function legacyDatabase(target: FinanceDatabase) {
  const name = (await target.syncState.get('legacySource'))?.value;
  if (!name) return undefined;
  const source = new FinanceDatabase(name);
  const owner = (await source.syncState.get('claimedBy'))?.value;
  if (owner !== target.name) {
    source.close();
    return undefined;
  }
  return source;
}
