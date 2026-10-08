import { database, type FinanceDatabase } from '../db/database';
import { DexieRepository, DexieTransactionRepository } from '../db/repositories/repository';
import {
  accountSchema,
  active,
  budgetSchema,
  categorySchema,
  goalSchema,
  transactionSchema,
  type Account,
  type Budget,
  type Category,
  type Entity,
  type FinanceData,
  type SavingsGoal,
  type Transaction,
} from '../types/models';
export class FinanceService {
  readonly accounts;
  readonly categories;
  readonly transactions;
  readonly budgets;
  readonly savingsGoals;
  constructor(private db: FinanceDatabase) {
    this.accounts = new DexieRepository<Account>(db.accounts, accountSchema);
    this.categories = new DexieRepository<Category>(db.categories, categorySchema);
    this.transactions = new DexieTransactionRepository(db.transactions, transactionSchema);
    this.budgets = new DexieRepository<Budget>(db.budgets, budgetSchema);
    this.savingsGoals = new DexieRepository<SavingsGoal>(db.savingsGoals, goalSchema);
  }
  async snapshot(): Promise<FinanceData> {
    return this.db.transaction('r', this.db.tables, async () => ({
      accounts: await this.accounts.getAll(),
      categories: await this.categories.getAll(),
      transactions: await this.transactions.getAll(),
      budgets: await this.budgets.getAll(),
      savingsGoals: await this.savingsGoals.getAll(),
      settings: active(await this.db.settings.toArray()),
    }));
  }
  async saveTransaction(data: Transaction, editing = false) {
    const parsed = transactionSchema.parse(data);
    await this.db.transaction(
      'rw',
      [this.db.accounts, this.db.categories, this.db.transactions],
      async () => {
        const account = await this.accounts.getById(parsed.accountId);
        if (!account) throw new Error('Tài khoản đã bị xóa. Hãy chọn lại.');
        if (parsed.toAccountId) {
          const destination = await this.accounts.getById(parsed.toAccountId);
          if (!destination || destination.currency !== account.currency)
            throw new Error('Tài khoản nhận không hợp lệ.');
        }
        if (parsed.categoryId) {
          const category = await this.categories.getById(parsed.categoryId);
          if (!category || category.type !== parsed.type)
            throw new Error('Danh mục không phù hợp với giao dịch.');
        }
        if (editing) await this.transactions.update(parsed.id, parsed);
        else await this.transactions.create(parsed);
      },
    );
  }
  async saveAccount(data: Account, editing = false) {
    if (editing) await this.accounts.update(data.id, data);
    else await this.accounts.create(data);
  }
  async saveCategory(data: Category, editing = false) {
    if (editing) await this.categories.update(data.id, data);
    else await this.categories.create(data);
  }
  async saveBudget(data: Budget, editing = false) {
    const parsed = budgetSchema.parse(data);
    await this.db.transaction('rw', [this.db.budgets, this.db.categories], async () => {
      if (
        parsed.categoryId &&
        (await this.categories.getById(parsed.categoryId))?.type !== 'expense'
      )
        throw new Error('Ngân sách cần danh mục chi tiêu.');
      if (
        (await this.budgets.getAll()).some(
          (b) => b.id !== data.id && b.month === data.month && b.categoryId === data.categoryId,
        )
      )
        throw new Error('Tháng này đã có ngân sách cho danh mục đó. Hãy sửa ngân sách hiện có.');
      if (editing) await this.budgets.update(data.id, parsed);
      else await this.budgets.create(parsed);
    });
  }
  async saveGoal(data: SavingsGoal, editing = false) {
    if (editing) await this.savingsGoals.update(data.id, data);
    else await this.savingsGoals.create(data);
  }
  async removeAccount(id: string) {
    await this.db.transaction('rw', [this.db.accounts, this.db.transactions], async () => {
      if (
        (await this.transactions.getAll()).some((t) => t.accountId === id || t.toAccountId === id)
      )
        throw new Error(
          'Tài khoản đang có giao dịch. Chuyển hoặc xóa các giao dịch trước khi xóa tài khoản.',
        );
      await this.accounts.remove(id);
    });
  }
  async removeCategory(id: string) {
    await this.db.transaction(
      'rw',
      [this.db.categories, this.db.transactions, this.db.budgets],
      async () => {
        if (
          (await this.transactions.getAll()).some((t) => t.categoryId === id) ||
          (await this.budgets.getAll()).some((b) => b.categoryId === id)
        )
          throw new Error('Danh mục đang được sử dụng trong giao dịch hoặc ngân sách.');
        await this.categories.remove(id);
      },
    );
  }
  async getSetting(key: string) {
    const item = await this.db.settings.where('key').equals(key).first();
    return item && !item.deletedAt ? item.value : undefined;
  }
  async setSetting(key: string, value: string) {
    await this.db.transaction('rw', this.db.settings, async () => {
      const item = await this.db.settings.where('key').equals(key).first();
      const now = new Date().toISOString();
      await this.db.settings.put(
        item
          ? { ...item, value, updatedAt: now, deletedAt: null }
          : {
              id: crypto.randomUUID(),
              key,
              value,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
            },
      );
    });
  }
}
export const finance = new FinanceService(database);
export type EditableRecord = Entity;
