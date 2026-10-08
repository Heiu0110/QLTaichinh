import Dexie, { type Table } from 'dexie';
import {
  stamp,
  type Account,
  type Transaction,
  type Category,
  type Budget,
  type SavingsGoal,
  type Setting,
} from '../types/models';
import type { Mutation, RemoteMeta, SyncState, SyncConflict } from '../sync/syncTypes';
const expenseNames = [
  'Ăn uống',
  'Di chuyển',
  'Mua sắm',
  'Nhà cửa',
  'Điện nước',
  'Giải trí',
  'Sức khỏe',
  'Giáo dục',
  'Khác',
];
const incomeNames = ['Lương', 'Thưởng', 'Kinh doanh', 'Đầu tư', 'Khác'];
export class FinanceDatabase extends Dexie {
  accounts!: Table<Account, string>;
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  budgets!: Table<Budget, string>;
  savingsGoals!: Table<SavingsGoal, string>;
  settings!: Table<Setting, string>;
  syncQueue!: Table<Mutation, string>;
  syncRemoteMeta!: Table<RemoteMeta, [string, string]>;
  syncState!: Table<SyncState, string>;
  syncConflicts!: Table<SyncConflict, string>;
  readonly cloud: boolean;
  private retired = false;
  retire() {
    this.retired = true;
    this.close();
  }
  async assertWritable() {
    if (this.retired) throw new Error('Phiên dữ liệu đã đóng. Hãy mở lại màn hình.');
    if (await this.syncState.get('claimedBy'))
      throw new Error('Sổ local này đã được giữ riêng cho tài khoản cloud.');
    if (this.cloud && (await this.syncState.get('ready'))?.value !== 'true')
      throw new Error('Hoàn tất thiết lập đồng bộ trước khi sửa dữ liệu.');
  }
  constructor(name = 'sotien-v1', options: { cloud?: boolean; seed?: boolean } = {}) {
    super(name);
    this.cloud = options.cloud ?? false;
    // Version 1 is immutable. Future migrations add .version(2).stores(...).upgrade(...).
    this.version(1).stores({
      accounts: 'id, type, updatedAt',
      transactions: 'id, accountId, toAccountId, categoryId, date, type, updatedAt',
      categories: 'id, type, updatedAt',
      budgets: 'id, month, categoryId, updatedAt',
      savingsGoals: 'id, updatedAt',
      settings: 'id, &key, updatedAt',
    });
    this.version(2).stores({
      syncQueue:
        '&mutationId, [entityType+entityId], status, [status+nextAttemptAt], dependsOnMutationId, localOrder',
      syncRemoteMeta: '[entityType+entityId]',
      syncState: '&key',
      syncConflicts: '&id, [entityType+entityId], status, mutationId',
    });
    this.on('populate', (tx) => {
      if (options.seed === false || this.cloud) return;
      const categories: Category[] = [
        ...expenseNames.map((name) => ({ ...stamp(), name, type: 'expense' as const })),
        ...incomeNames.map((name) => ({ ...stamp(), name, type: 'income' as const })),
      ];
      return Promise.all([
        tx.table('categories').bulkAdd(categories),
        tx
          .table('accounts')
          .add({ ...stamp(), name: 'Tiền mặt', type: 'cash', initialBalance: 0, currency: 'VND' }),
        tx.table('settings').add({ ...stamp(), key: 'schemaVersion', value: '1' }),
      ]).then(() => undefined);
    });
  }
}
export const database = new FinanceDatabase();

export const userDatabaseName = (projectScope: string, userId: string) =>
  `sotien-user-${encodeURIComponent(projectScope)}-${userId}`;
