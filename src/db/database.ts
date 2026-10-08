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
  constructor(name = 'sotien-v1') {
    super(name);
    // Version 1 is immutable. Future migrations add .version(2).stores(...).upgrade(...).
    this.version(1).stores({
      accounts: 'id, type, updatedAt',
      transactions: 'id, accountId, toAccountId, categoryId, date, type, updatedAt',
      categories: 'id, type, updatedAt',
      budgets: 'id, month, categoryId, updatedAt',
      savingsGoals: 'id, updatedAt',
      settings: 'id, &key, updatedAt',
    });
    this.on('populate', (tx) => {
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
