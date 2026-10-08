import type { RemoteSyncRepository } from '../src/sync/remote/RemoteSyncRepository';
import {
  entityKey,
  entityTypes,
  type Mutation,
  type PushResult,
  type Change,
  type EntityType,
  type DomainRecord,
} from '../src/sync/syncTypes';
import { validateBackup } from '../src/services/backup/backup';
export class FakeRemoteSyncRepository implements RemoteSyncRepository {
  records = new Map<string, Change>();
  receipts = new Map<string, { hash: string; result: PushResult }>();
  changes: Change[] = [];
  initialized = true;
  loseAck = false;
  beforeReply?: () => Promise<void>;
  staged = new Map<string, { entityType: EntityType; payload: DomainRecord }[]>();
  async pushMutation(m: Mutation): Promise<PushResult> {
    const hash = JSON.stringify([m.entityType, m.payload, m.baseVersion]);
    const receipt = this.receipts.get(m.mutationId);
    if (receipt) {
      if (receipt.hash !== hash) throw Error('mutation reuse');
      return structuredClone(receipt.result);
    }
    const current = this.records.get(entityKey(m.entityType, m.entityId));
    let result: PushResult;
    if ((current?.version ?? null) !== m.baseVersion)
      result = {
        status: 'conflict',
        payload: current?.payload ?? null,
        version: current?.version ?? null,
      };
    else {
      const data = Object.fromEntries(
        entityTypes.map((t) => [
          t,
          [...this.records.values()]
            .filter(
              (r) => r.entityType === t && !(m.entityType === t && r.payload.id === m.entityId),
            )
            .map((r) => r.payload),
        ]),
      ) as Record<EntityType, DomainRecord[]>;
      data[m.entityType].push(m.payload);
      try {
        validateBackup({
          app: 'sotien',
          version: 1,
          exportedAt: new Date().toISOString(),
          data: { ...data, settings: [] },
        });
        const change = {
          entityType: m.entityType,
          payload: structuredClone(m.payload),
          version: String(this.changes.length + 1),
          mutationId: m.mutationId,
        };
        this.records.set(entityKey(m.entityType, m.entityId), change);
        this.changes.push(change);
        result = { status: 'applied', payload: change.payload, version: change.version };
      } catch {
        result = { status: 'invalid', code: '23503' };
      }
    }
    this.receipts.set(m.mutationId, { hash, result });
    if (this.beforeReply) {
      const fn = this.beforeReply;
      this.beforeReply = undefined;
      await fn();
    }
    if (this.loseAck) {
      this.loseAck = false;
      throw Error('lost ACK');
    }
    return structuredClone(result);
  }
  async pullChanges(after: string, limit = 200, upper?: string) {
    const hi = upper ?? String(this.changes.length);
    const changes = this.changes
      .filter((c) => BigInt(c.version) > BigInt(after) && BigInt(c.version) <= BigInt(hi))
      .slice(0, limit);
    return structuredClone({
      initialized: this.initialized,
      upperBound: hi,
      cursor: changes.at(-1)?.version ?? after,
      changes,
    });
  }
  async stage(id: string, records: { entityType: EntityType; payload: DomainRecord }[]) {
    this.staged.set(id, [...(this.staged.get(id) ?? []), ...records]);
  }
  async initialize(id: string, count: number) {
    if (this.initialized) throw Error('already initialized');
    const records = this.staged.get(id) ?? [];
    if (count !== records.length) throw Error('incomplete');
    this.initialized = true;
    for (const r of records)
      await this.pushMutation({
        mutationId: crypto.randomUUID(),
        entityType: r.entityType,
        entityId: r.payload.id,
        payload: r.payload,
        baseVersion: null,
        status: 'attempted',
        localOrder: 0,
        attempts: 1,
        nextAttemptAt: 0,
      });
  }
}
