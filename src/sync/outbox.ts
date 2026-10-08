import type { FinanceDatabase } from '../db/database';
import { type DomainRecord, type EntityType } from './syncTypes';
// Caller holds one transaction across the domain table, queue, metadata and state.
export async function enqueue(db: FinanceDatabase, entityType: EntityType, payload: DomainRecord) {
  if (!db.cloud) return;
  const rows = await db.syncQueue
    .where('[entityType+entityId]')
    .equals([entityType, payload.id])
    .sortBy('localOrder');
  const tail = rows.at(-1);
  if (tail?.status === 'pending') {
    await db.syncQueue.update(tail.mutationId, { payload });
    return;
  }
  const order = Number((await db.syncState.get('localOrder'))?.value ?? '0') + 1;
  if (!Number.isSafeInteger(order)) throw new Error('Hàng đợi vượt giới hạn. Hãy xuất backup.');
  await db.syncState.put({ key: 'localOrder', value: String(order) });
  const remote = await db.syncRemoteMeta.get([entityType, payload.id]);
  await db.syncQueue.add({
    mutationId: crypto.randomUUID(),
    entityType,
    entityId: payload.id,
    payload,
    baseVersion: remote?.version ?? null,
    status: 'pending',
    ...(tail ? { dependsOnMutationId: tail.mutationId } : {}),
    localOrder: order,
    attempts: 0,
    nextAttemptAt: 0,
  });
}
