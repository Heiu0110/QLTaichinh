import type { FinanceDatabase } from '../db/database';
import { legacyDatabase } from '../db/context/profiles';
import { BackupService } from '../services/backup/backup';
import { entityTypes, type DomainRecord, type EntityType } from './syncTypes';
import { SyncEngine } from './SyncEngine';
export class BootstrapService {
  private stop = new AbortController();
  dispose() {
    this.stop.abort();
  }
  constructor(
    readonly db: FinanceDatabase,
    readonly engine: SyncEngine,
  ) {}
  async inspect(signal: AbortSignal = this.stop.signal) {
    const remote = await this.engine.remote.pullChanges('0', 1, undefined, signal);
    const source = await legacyDatabase(this.db);
    try {
      const backup = source ? await new BackupService(source).export() : undefined;
      return {
        initialized: remote.initialized,
        legacy: backup
          ? { accounts: backup.data.accounts.length, transactions: backup.data.transactions.length }
          : undefined,
      };
    } finally {
      source?.close();
    }
  }
  async exportLegacy() {
    const source = await legacyDatabase(this.db);
    if (!source) throw new Error('Không có sổ local được giữ cho tài khoản này.');
    try {
      return await new BackupService(source).export();
    } finally {
      source.close();
    }
  }
  async start(choice: 'upload' | 'download' | 'empty', signal: AbortSignal = this.stop.signal) {
    if ((await this.db.syncState.get('ready'))?.value === 'true') return;
    if (choice !== 'download') {
      const id = await this.db.transaction('rw', this.db.syncState, async () => {
        const stored = (await this.db.syncState.get('bootstrapId'))?.value;
        const mode = (await this.db.syncState.get('bootstrapChoice'))?.value;
        if (mode && mode !== choice)
          throw new Error(
            'Hãy hoàn tất lần tải đang dở, hoặc chọn dữ liệu cloud nếu thiết bị khác đã thiết lập.',
          );
        if (stored) return stored;
        const created = crypto.randomUUID();
        await this.db.syncState.bulkPut([
          { key: 'bootstrapId', value: created },
          { key: 'bootstrapChoice', value: choice },
        ]);
        return created;
      });
      const records: { entityType: EntityType; payload: DomainRecord }[] = [];
      if (choice === 'upload') {
        const backup = await this.exportLegacy();
        for (const type of entityTypes)
          for (const payload of backup.data[type]) records.push({ entityType: type, payload });
      }
      // After a lost final ACK, initialize is idempotent. Avoid staging into an already
      // initialized cloud; the server still verifies this bootstrap token on publish.
      const status = await this.engine.remote.pullChanges('0', 1, undefined, signal);
      if (!status.initialized)
        for (let i = 0; i < records.length; i += 200)
          await this.engine.remote.stage(id, records.slice(i, i + 200), signal);
      await this.engine.remote.initialize(id, records.length, signal);
    }
    await this.engine.pull(signal);
    if (signal?.aborted) throw new DOMException('Stopped', 'AbortError');
    await this.db.syncState.bulkPut([
      { key: 'ready', value: 'true' },
      { key: 'lastSync', value: new Date().toISOString() },
    ]);
  }
}
