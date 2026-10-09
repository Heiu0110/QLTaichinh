import { database, type FinanceDatabase } from '../db/database';
import { bankPresets, matchesBank } from '../utils/bankAccounts';
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
  stamp,
} from '../types/models';
export class FinanceService {
  readonly accounts;
  readonly categories;
  readonly transactions;
  readonly budgets;
  readonly savingsGoals;
  constructor(private db: FinanceDatabase) {
    this.accounts = new DexieRepository<Account>(db.accounts, accountSchema, db, 'accounts');
    this.categories = new DexieRepository<Category>(
      db.categories,
      categorySchema,
      db,
      'categories',
    );
    this.transactions = new DexieTransactionRepository(
      db.transactions,
      transactionSchema,
      db,
      'transactions',
    );
    this.budgets = new DexieRepository<Budget>(db.budgets, budgetSchema, db, 'budgets');
    this.savingsGoals = new DexieRepository<SavingsGoal>(
      db.savingsGoals,
      goalSchema,
      db,
      'savingsGoals',
    );
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
  async saveTransaction(data: Transaction, editing = false, expected?: Transaction) {
    const parsed = transactionSchema.parse(data);
    await this.db.transaction('rw', this.db.tables, async () => {
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
      if (editing) await this.transactions.update(parsed.id, parsed, expected);
      else await this.transactions.create(parsed);
    });
  }
  // Only materialize preset banks when the user saves a transaction. Account,
  // transaction and outbox writes share one transaction, including on failure.
  async saveTransactionWithAccountChoices(
    data: Transaction,
    editing = false,
    expected?: Transaction,
  ) {
    await this.db.transaction('rw', this.db.tables, async () => {
      await this.db.assertWritable();
      const resolve = async (selection: string) => {
        const bank = bankPresets.find((preset) => preset.id === selection);
        if (!bank) return selection;
        const matches = (await this.accounts.getAll()).filter((account) =>
          matchesBank(account, bank),
        );
        if (matches.length > 1)
          throw new Error('Có nhiều tài khoản ngân hàng cùng tên. Hãy chọn lại tài khoản cụ thể.');
        if (matches[0]) return matches[0].id;
        const account: Account = {
          ...stamp(),
          name: bank.name,
          type: 'bank',
          currency: 'VND',
          initialBalance: 0,
        };
        await this.saveAccount(account);
        return account.id;
      };
      const accountId = await resolve(data.accountId);
      const toAccountId =
        data.type === 'transfer' && data.toAccountId
          ? await resolve(data.toAccountId)
          : data.toAccountId;
      await this.saveTransaction({ ...data, accountId, toAccountId }, editing, expected);
    });
  }
  async saveAccount(data: Account, editing = false, expected?: Account) {
    if (editing) await this.accounts.update(data.id, data, expected);
    else await this.accounts.create(data);
  }
  async saveCategory(data: Category, editing = false, expected?: Category) {
    await this.db.transaction('rw', this.db.tables, async () => {
      if (editing) {
        const current = await this.categories.getById(data.id);
        if (
          current?.type !== data.type &&
          ((await this.db.transactions.toArray()).some((t) => t.categoryId === data.id) ||
            (await this.db.budgets.toArray()).some((b) => b.categoryId === data.id))
        )
          throw new Error('Không thể đổi loại danh mục đã được sử dụng.');
        await this.categories.update(data.id, data, expected);
      } else await this.categories.create(data);
    });
  }
  async saveBudget(data: Budget, editing = false, expected?: Budget) {
    const parsed = budgetSchema.parse(data);
    await this.db.transaction('rw', this.db.tables, async () => {
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
      if (editing) await this.budgets.update(data.id, parsed, expected);
      else await this.budgets.create(parsed);
    });
  }
  async saveGoal(data: SavingsGoal, editing = false, expected?: SavingsGoal) {
    if (editing) await this.savingsGoals.update(data.id, data, expected);
    else await this.savingsGoals.create(data);
  }
  async removeAccount(id: string) {
    await this.db.transaction('rw', this.db.tables, async () => {
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
    await this.db.transaction('rw', this.db.tables, async () => {
      if (
        (await this.transactions.getAll()).some((t) => t.categoryId === id) ||
        (await this.budgets.getAll()).some((b) => b.categoryId === id)
      )
        throw new Error('Danh mục đang được sử dụng trong giao dịch hoặc ngân sách.');
      await this.categories.remove(id);
    });
  }
  async getSetting(key: string) {
    const item = await this.db.settings.where('key').equals(key).first();
    return item && !item.deletedAt ? item.value : undefined;
  }
  async setSetting(key: string, value: string) {
    await this.db.transaction('rw', this.db.tables, async () => {
      await this.db.assertWritable();
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
