import type { Transaction, Budget, Category } from '../types/models';
import type { FinanceDatabase } from '../db/database';
import type { RemoteSyncRepository } from './remote/RemoteSyncRepository';
import {
  type Change,
  type DomainRecord,
  type EntityType,
  type Mutation,
  type PushResult,
  entityKey,
} from './syncTypes';
import { BackupService, validateBackup } from '../services/backup/backup';
import { enqueue } from './outbox';
export class SyncEngine {
  constructor(
    readonly db: FinanceDatabase,
    readonly remote: RemoteSyncRepository,
  ) {}
  private check(signal?: AbortSignal) {
    if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
  }
  private async conflict(
    type: EntityType,
    id: string,
    local: DomainRecord,
    remote: DomainRecord | null,
    version: string | null,
    mutation?: Mutation,
    reason: 'concurrent' | 'reference' | 'validation' = 'concurrent',
  ) {
    await this.db.syncConflicts.put({
      id: entityKey(type, id),
      entityType: type,
      entityId: id,
      mutationId: mutation?.mutationId ?? crypto.randomUUID(),
      localData: local,
      remoteData: remote,
      baseVersion: mutation?.baseVersion ?? null,
      remoteVersion: version,
      detectedAt: new Date().toISOString(),
      status: 'unresolved',
      reason,
    });
    if (mutation) await this.db.syncQueue.update(mutation.mutationId, { status: 'blocked' });
  }
  async accept(m: Mutation, result: PushResult, signal?: AbortSignal) {
    this.check(signal);
    await this.db.transaction('rw', this.db.tables, async () => {
      this.check(signal);
      const current = await this.db.syncQueue.get(m.mutationId);
      if (!current) return;
      const local = await this.db.table<DomainRecord>(m.entityType).get(m.entityId);
      if (!local) throw new Error('Missing local mutation record');
      if (result.status !== 'applied') {
        const meta = await this.db.syncRemoteMeta.get([m.entityType, m.entityId]);
        let payload = result.status === 'conflict' ? result.payload : (meta?.payload ?? null);
        let version = result.status === 'conflict' ? result.version : (meta?.version ?? null);
        if (meta && (!version || BigInt(meta.version) > BigInt(version))) {
          payload = meta.payload;
          version = meta.version;
        }
        if (payload && version && (!meta || BigInt(version) > BigInt(meta.version)))
          await this.db.syncRemoteMeta.put({
            entityType: m.entityType,
            entityId: m.entityId,
            payload,
            version,
          });
        await this.conflict(
          m.entityType,
          m.entityId,
          local,
          payload,
          version,
          current,
          result.status === 'conflict'
            ? 'concurrent'
            : result.code === '23503'
              ? 'reference'
              : 'validation',
        );
        return;
      }
      if (!result.payload || !result.version) throw new Error('Invalid acknowledgment');
      const meta = await this.db.syncRemoteMeta.get([m.entityType, m.entityId]);
      if (!meta || BigInt(result.version) > BigInt(meta.version))
        await this.db.syncRemoteMeta.put({
          entityType: m.entityType,
          entityId: m.entityId,
          payload: result.payload,
          version: result.version,
        });
      await this.db.syncQueue.delete(m.mutationId);
      const successors = await this.db.syncQueue
        .where('dependsOnMutationId')
        .equals(m.mutationId)
        .toArray();
      for (const successor of successors)
        await this.db.syncQueue.put({
          ...successor,
          baseVersion: result.version,
          dependsOnMutationId: undefined,
        });
      // Never replace the desired local record on ACK: it may already contain a newer edit.
    });
  }
  async push(signal?: AbortSignal) {
    // A bounded pass. Mutations created during a long run are picked up by coordinator triggers.
    const ids = (await this.db.syncQueue.orderBy('localOrder').toArray()).map((m) => m.mutationId);
    for (const id of ids) {
      this.check(signal);
      const m = await this.db.transaction('rw', this.db.tables, async () => {
        const current = await this.db.syncQueue.get(id);
        if (!current || current.status === 'blocked' || current.dependsOnMutationId)
          return undefined;
        const attempted = {
          ...current,
          status: 'attempted' as const,
          attempts: current.attempts + 1,
        };
        await this.db.syncQueue.put(attempted);
        return attempted;
      });
      if (!m) continue;
      const result = await this.remote.pushMutation(m, signal);
      this.check(signal);
      await this.accept(m, result, signal);
    }
  }
  private async safeApply(change: Change) {
    const { entityType, payload, version } = change;
    const table = this.db.table<DomainRecord>(entityType);
    const current = await table.get(payload.id);
    let valid = true;
    if (entityType === 'accounts' && payload.deletedAt) {
      valid = !(await this.db.transactions.toArray()).some(
        (t) => !t.deletedAt && (t.accountId === payload.id || t.toAccountId === payload.id),
      );
    } else if (entityType === 'categories') {
      const category = payload as Category;
      valid =
        !(await this.db.transactions.where('categoryId').equals(payload.id).toArray()).some(
          (t) => category.type !== t.type || (!!category.deletedAt && !t.deletedAt),
        ) &&
        !(await this.db.budgets.where('categoryId').equals(payload.id).toArray()).some(
          (b) => category.type !== 'expense' || (!!category.deletedAt && !b.deletedAt),
        );
    } else if (entityType === 'transactions') {
      const t = payload as Transaction;
      const source = await this.db.accounts.get(t.accountId);
      const target = t.toAccountId ? await this.db.accounts.get(t.toAccountId) : undefined;
      const category = t.categoryId ? await this.db.categories.get(t.categoryId) : undefined;
      valid =
        !!source &&
        (!t.toAccountId || !!target) &&
        (!t.categoryId || (!!category && category.type === t.type)) &&
        (!!t.deletedAt || !(source.deletedAt || target?.deletedAt || category?.deletedAt));
    } else if (entityType === 'budgets') {
      const b = payload as Budget;
      const category = b.categoryId ? await this.db.categories.get(b.categoryId) : undefined;
      valid =
        (!b.categoryId ||
          (!!category && category.type === 'expense' && (!!b.deletedAt || !category.deletedAt))) &&
        (!!b.deletedAt ||
          !(await this.db.budgets.where('month').equals(b.month).toArray()).some(
            (other) => other.id !== b.id && !other.deletedAt && other.categoryId === b.categoryId,
          ));
    }
    if (!valid) {
      if (!current)
        throw new Error('Tham chiếu dữ liệu đang xung đột. Hãy xử lý xung đột trước khi kéo tiếp.');
      await this.conflict(
        entityType,
        payload.id,
        current,
        payload,
        version,
        undefined,
        'reference',
      );
      return;
    }
    await table.put(payload);
  }
  async applyPage(changes: Change[], cursor: string, expectedCursor: string, signal?: AbortSignal) {
    this.check(signal);
    await this.db.transaction('rw', this.db.tables, async () => {
      this.check(signal);
      const stored = (await this.db.syncState.get('cursor'))?.value ?? '0';
      // A second tab may have applied this page while the network was in flight.
      if (stored !== expectedCursor) return;
      for (const change of changes) {
        const { entityType, payload, version } = change;
        const meta = await this.db.syncRemoteMeta.get([entityType, payload.id]);
        if (meta && BigInt(meta.version) >= BigInt(version)) continue;
        const pending = await this.db.syncQueue
          .where('[entityType+entityId]')
          .equals([entityType, payload.id])
          .sortBy('localOrder');
        const own = pending.find((m) => m.mutationId === change.mutationId);
        if (own) {
          await this.accept(own, { status: 'applied', payload, version }, signal);
          continue;
        }
        const existing = await this.db.syncConflicts.get(entityKey(entityType, payload.id));
        const local = await this.db.table<DomainRecord>(entityType).get(payload.id);
        if ((pending.length || existing) && local) {
          const first = pending[0];
          await this.conflict(
            entityType,
            payload.id,
            local,
            payload,
            version,
            first,
            existing?.reason ?? 'concurrent',
          );
        } else await this.safeApply(change);
        await this.db.syncRemoteMeta.put({ entityType, entityId: payload.id, version, payload });
      }
      await this.db.syncState.put({ key: 'cursor', value: cursor });
    });
  }
  async pull(signal?: AbortSignal) {
    let upper: string | undefined;
    while (true) {
      this.check(signal);
      const after = (await this.db.syncState.get('cursor'))?.value ?? '0';
      const page = await this.remote.pullChanges(after, 200, upper, signal);
      this.check(signal);
      if (!page.initialized) throw new Error('Cloud chưa được thiết lập.');
      upper = page.upperBound;
      await this.applyPage(page.changes, page.cursor, after, signal);
      if (BigInt((await this.db.syncState.get('cursor'))?.value ?? '0') >= BigInt(upper)) return;
    }
  }
  async sync(signal?: AbortSignal) {
    await this.push(signal);
    await this.pull(signal);
    this.check(signal);
    await this.db.syncState.put({ key: 'lastSync', value: new Date().toISOString() });
  }
  async resolve(id: string, choice: 'local' | 'cloud') {
    await this.db.transaction('rw', this.db.tables, async () => {
      await this.db.assertWritable();
      const conflict = await this.db.syncConflicts.get(id);
      if (!conflict) return;
      const { entityType, entityId } = conflict;
      const table = this.db.table<DomainRecord>(entityType);
      const meta = await this.db.syncRemoteMeta.get([entityType, entityId]);
      const remote = meta?.payload ?? conflict.remoteData;
      const local = await table.get(entityId);
      if (!local) throw new Error('Không tìm thấy bản local.');
      if (choice === 'cloud') {
        if (!remote)
          throw new Error('Cloud chưa có bản ghi này. Hãy sửa dữ liệu local rồi thử lại.');
        const data = (await new BackupService(this.db).export()).data;
        try {
          validateBackup({
            app: 'sotien',
            version: 1,
            exportedAt: new Date().toISOString(),
            data: {
              ...data,
              [entityType]: [...data[entityType].filter((r) => r.id !== entityId), remote],
            },
          });
        } catch {
          throw new Error(
            'Bản cloud sẽ làm mất tham chiếu. Sửa hoặc xóa các giao dịch/ngân sách đang dùng bản ghi này rồi chọn lại.',
          );
        }
        await table.put(remote);
      }
      await this.db.syncQueue
        .where('[entityType+entityId]')
        .equals([entityType, entityId])
        .delete();
      await this.db.syncConflicts.delete(id);
      if (choice === 'local') await enqueue(this.db, entityType, local);
    });
  }
}
