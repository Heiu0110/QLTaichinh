import type { FinanceDatabase } from '../database';
import { enqueue } from '../../sync/outbox';
import type { DomainRecord, EntityType } from '../../sync/syncTypes';
import { type Table } from 'dexie';
import { type z } from 'zod';
import { type Entity, type Transaction, active } from '../../types/models';
export interface Repository<T extends Entity> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  create(data: T): Promise<void>;
  update(id: string, data: Partial<T>, expected?: T): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface TransactionRepository extends Repository<Transaction> {}
export class DexieRepository<T extends Entity> implements Repository<T> {
  constructor(
    protected table: Table<T, string>,
    private schema: z.ZodType<T>,
    private db: FinanceDatabase,
    private kind: EntityType,
  ) {}
  async getAll() {
    return active(await this.table.toArray());
  }
  async getById(id: string) {
    const item = await this.table.get(id);
    return item && !item.deletedAt ? item : undefined;
  }
  async create(data: T) {
    await this.db.transaction('rw', this.db.tables, async () => {
      await this.db.assertWritable();
      const parsed = this.schema.parse(data);
      await this.table.add(parsed);
      await enqueue(this.db, this.kind, parsed as DomainRecord);
    });
  }
  async update(id: string, data: Partial<T>, expected?: T) {
    await this.db.transaction('rw', this.db.tables, async () => {
      await this.db.assertWritable();
      const item = await this.getById(id);
      if (!item) throw new Error('Bản ghi không còn tồn tại.');
      if (
        expected &&
        JSON.stringify(this.schema.parse(item)) !== JSON.stringify(this.schema.parse(expected))
      )
        throw new Error(
          'Bản ghi đã thay đổi khi bạn đang mở form. Nội dung đang nhập vẫn được giữ ở đây; ghi lại thay đổi rồi đóng và mở lại bản mới trước khi lưu.',
        );
      const parsed = this.schema.parse({
        ...item,
        ...data,
        id,
        createdAt: item.createdAt,
        updatedAt: new Date().toISOString(),
      });
      await this.table.put(parsed);
      await enqueue(this.db, this.kind, parsed as DomainRecord);
    });
  }
  async remove(id: string) {
    await this.update(id, { deletedAt: new Date().toISOString() } as Partial<T>);
  }
}
export class DexieTransactionRepository
  extends DexieRepository<Transaction>
  implements TransactionRepository {}
