import { type Table } from 'dexie';
import { type z } from 'zod';
import { type Entity, type Transaction, active } from '../../types/models';
export interface Repository<T extends Entity> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  create(data: T): Promise<void>;
  update(id: string, data: Partial<T>): Promise<void>;
  remove(id: string): Promise<void>;
}
export interface TransactionRepository extends Repository<Transaction> {}
export class DexieRepository<T extends Entity> implements Repository<T> {
  constructor(
    protected table: Table<T, string>,
    private schema: z.ZodType<T>,
  ) {}
  async getAll() {
    return active(await this.table.toArray());
  }
  async getById(id: string) {
    const item = await this.table.get(id);
    return item && !item.deletedAt ? item : undefined;
  }
  async create(data: T) {
    await this.table.add(this.schema.parse(data));
  }
  async update(id: string, data: Partial<T>) {
    await this.table.db.transaction('rw', this.table, async () => {
      const item = await this.getById(id);
      if (!item) throw new Error('Bản ghi không còn tồn tại.');
      await this.table.put(
        this.schema.parse({
          ...item,
          ...data,
          id,
          createdAt: item.createdAt,
          updatedAt: new Date().toISOString(),
        }),
      );
    });
  }
  async remove(id: string) {
    await this.update(id, { deletedAt: new Date().toISOString() } as Partial<T>);
  }
}
export class DexieTransactionRepository
  extends DexieRepository<Transaction>
  implements TransactionRepository {}
