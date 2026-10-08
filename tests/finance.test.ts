import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FinanceDatabase } from '../src/db/database';
import { FinanceService } from '../src/services/finance';
import { BackupService, validateBackup } from '../src/services/backup/backup';
import {
  accountBalance,
  budgetUsage,
  categoryTotal,
  filterTransactions,
  monthlyTotals,
  sumMoney,
} from '../src/utils/calculations';
import { isCalendarDate, parseMoney, today } from '../src/utils/format';
import {
  stamp,
  transactionSchema,
  type Account,
  type Category,
  type Transaction,
} from '../src/types/models';
let db: FinanceDatabase;
let service: FinanceService;
let backups: BackupService;
let account: Account;
let category: Category;
beforeEach(async () => {
  db = new FinanceDatabase(`test-${crypto.randomUUID()}`);
  service = new FinanceService(db);
  backups = new BackupService(db);
  const data = await service.snapshot();
  account = data.accounts[0];
  category = data.categories.find((c) => c.type === 'expense')!;
});
afterEach(async () => {
  await db.delete();
});
const entry = (data: Partial<Transaction> = {}): Transaction => ({
  ...stamp(),
  accountId: account.id,
  amount: 35000,
  date: '2026-10-08',
  type: 'expense',
  categoryId: category.id,
  ...data,
});
describe('Local-first finance workflow', () => {
  it('seeds exactly one empty account and 14 categories, without sample transactions', async () => {
    const data = await service.snapshot();
    expect(data.accounts).toHaveLength(1);
    expect(data.categories).toHaveLength(14);
    expect(data.transactions).toHaveLength(0);
  });
  it('adds income and expense and derives the balance', async () => {
    await service.saveTransaction(
      entry({ type: 'income', categoryId: undefined, amount: 10000000 }),
    );
    await service.saveTransaction(entry());
    const data = await service.snapshot();
    expect(accountBalance(account, data.transactions)).toBe(9965000);
    expect(monthlyTotals(data.transactions, '2026-10')).toEqual({
      income: 10000000,
      expense: 35000,
      cashFlow: 9965000,
    });
  });
  it('edits transaction without changing ID / createdAt and soft-deletes it', async () => {
    const tx = entry();
    await service.saveTransaction(tx);
    await service.saveTransaction({ ...tx, amount: 45000 }, true);
    expect((await service.transactions.getById(tx.id))?.createdAt).toBe(tx.createdAt);
    expect(accountBalance(account, await service.transactions.getAll())).toBe(-45000);
    await service.transactions.remove(tx.id);
    expect(await service.transactions.getAll()).toHaveLength(0);
    expect(await service.transactions.getById(tx.id)).toBeUndefined();
    expect((await db.transactions.get(tx.id))?.deletedAt).toBeTruthy();
    expect(accountBalance(account, await db.transactions.toArray())).toBe(0);
  });
  it('persists records across database close/reopen and does not reseed', async () => {
    const tx = entry();
    await service.saveTransaction(tx);
    db.close();
    await db.open();
    expect((await service.transactions.getById(tx.id))?.amount).toBe(35000);
    expect((await service.categories.getAll()).length).toBe(14);
  });
  it('moves money between accounts without treating a transfer as income or expense', async () => {
    const bank: Account = {
      ...stamp(),
      name: 'Ngân hàng',
      type: 'bank',
      initialBalance: 1000000,
      currency: 'VND',
    };
    await service.saveAccount(bank);
    const tx = entry({
      type: 'transfer',
      categoryId: undefined,
      toAccountId: bank.id,
      amount: 250000,
    });
    await service.saveTransaction(tx);
    const list = await service.transactions.getAll();
    expect(accountBalance(account, list)).toBe(-250000);
    expect(accountBalance(bank, list)).toBe(1250000);
    expect(monthlyTotals(list, '2026-10')).toEqual({ income: 0, expense: 0, cashFlow: 0 });
    expect(sumMoney([accountBalance(account, list), accountBalance(bank, list)])).toBe(1000000);
  });
  it('rejects missing accounts, wrong-category types, invalid transfers and zero amounts', async () => {
    await expect(
      service.saveTransaction(entry({ accountId: crypto.randomUUID() })),
    ).rejects.toThrow();
    await expect(service.saveTransaction(entry({ type: 'income' }))).rejects.toThrow();
    expect(
      transactionSchema.safeParse(entry({ type: 'transfer', toAccountId: account.id })).success,
    ).toBe(false);
    expect(transactionSchema.safeParse(entry({ amount: 0 })).success).toBe(false);
    expect(transactionSchema.safeParse(entry({ amount: 1.5 })).success).toBe(false);
  });
  it('blocks deleting an account/category referenced by active records', async () => {
    const tx = entry();
    await service.saveTransaction(tx);
    await expect(service.removeAccount(account.id)).rejects.toThrow('đang có giao dịch');
    await expect(service.removeCategory(category.id)).rejects.toThrow('đang được sử dụng');
    await service.transactions.remove(tx.id);
    await service.removeAccount(account.id);
    expect(await service.accounts.getAll()).toHaveLength(0);
  });
  it('includes same-day entries, respects month boundaries and excludes deleted rows', () => {
    const list = [
      entry({ date: '2026-09-30', amount: 10 }),
      entry({ date: '2026-10-01', amount: 20 }),
      entry({ date: '2026-10-01', amount: 30 }),
      entry({ date: '2026-10-31', amount: 40 }),
      entry({ date: '2026-11-01', amount: 50 }),
      entry({ deletedAt: new Date().toISOString(), amount: 60 }),
    ];
    expect(monthlyTotals(list, '2026-10').expense).toBe(90);
    expect(categoryTotal(list, '2026-10', category.id)).toBe(90);
    expect(monthlyTotals(list, '2026-09').expense).toBe(10);
    expect(monthlyTotals(list, '2026-11').expense).toBe(50);
  });
  it('calculates budget percentage and prevents duplicate budgets', async () => {
    const budget = {
      ...stamp(),
      amount: 100000,
      month: '2026-10',
      period: 'monthly' as const,
      categoryId: category.id,
    };
    await service.saveBudget(budget);
    await expect(service.saveBudget({ ...budget, ...stamp() })).rejects.toThrow('đã có ngân sách');
    expect(budgetUsage(budget, [entry({ amount: 125000 })])).toEqual({
      used: 125000,
      percentage: 125,
      remaining: -25000,
    });
  });
  it('filters by dates, type, account, category and note, including transfer destination', () => {
    const target = crypto.randomUUID();
    const a = entry({ note: 'Cà phê sáng', date: '2026-10-01' });
    const b = entry({ note: 'lương', type: 'income', categoryId: undefined });
    const c = entry({ type: 'transfer', categoryId: undefined, toAccountId: target });
    const filters = { from: '', to: '', type: '', accountId: '', categoryId: '', search: '' };
    expect(
      filterTransactions([a, b, c], {
        ...filters,
        search: 'PHÊ',
        type: 'expense',
        accountId: account.id,
        categoryId: category.id,
        from: '2026-10-01',
        to: '2026-10-01',
      }),
    ).toEqual([a]);
    expect(filterTransactions([a, b, c], { ...filters, accountId: target })).toEqual([c]);
  });
  it('supports zero initial balances, negative credit balance and large exact integers', async () => {
    expect(parseMoney('0')).toBe(0);
    expect(parseMoney('-100', true)).toBe(-100);
    expect(() => parseMoney('12.35')).toThrow();
    expect(() => parseMoney('1e6')).toThrow();
    expect(() => parseMoney('9007199254740992')).toThrow();
    await service.saveTransaction(
      entry({ amount: 1000000000000, type: 'income', categoryId: undefined }),
    );
    expect(
      accountBalance({ ...account, initialBalance: -1 }, await service.transactions.getAll()),
    ).toBe(999999999999);
    expect(() => sumMoney([Number.MAX_SAFE_INTEGER, 1])).toThrow();
  });
  it('uses local calendar days without converting transaction dates through UTC', () => {
    expect(isCalendarDate('2024-02-29')).toBe(true);
    expect(isCalendarDate('2026-02-29')).toBe(false);
    expect(isCalendarDate('2026-04-31')).toBe(false);
    expect(today(new Date(2026, 9, 1, 0, 1))).toBe('2026-10-01');
    expect(monthlyTotals([entry({ date: '2026-10-01' })], '2026-10').expense).toBe(35000);
  });
});
describe('Soft-deleted settings', () => {
  it('excludes deleted settings from normal reads and can restore a setting', async () => {
    await service.setSetting('sample', 'old');
    const item = await db.settings.where('key').equals('sample').first();
    await db.settings.update(item!.id, { deletedAt: new Date().toISOString() });
    expect(await service.getSetting('sample')).toBeUndefined();
    expect((await service.snapshot()).settings.some((s) => s.key === 'sample')).toBe(false);
    await service.setSetting('sample', 'new');
    expect(await service.getSetting('sample')).toBe('new');
  });
});
describe('Backup validation and atomic restore', () => {
  it('exports all tables and preserves tombstones through replacement', async () => {
    const tx = entry();
    await service.saveTransaction(tx);
    await service.transactions.remove(tx.id);
    const backup = await backups.export();
    expect(backup.data.transactions).toHaveLength(1);
    expect(backup.data.transactions[0].deletedAt).toBeTruthy();
    await service.saveTransaction(entry({ amount: 100 }));
    await backups.replace(JSON.parse(JSON.stringify(backup)));
    expect(await service.transactions.getAll()).toHaveLength(0);
    expect(await db.transactions.count()).toBe(1);
    expect(await backups.export()).toMatchObject({ data: backup.data });
  });
  it('restores budgets, goals and settings as well as transactions', async () => {
    await service.saveTransaction(entry());
    await service.saveBudget({
      ...stamp(),
      categoryId: category.id,
      month: '2026-10',
      period: 'monthly',
      amount: 100000,
    });
    await service.saveGoal({
      ...stamp(),
      name: 'Du lịch',
      targetAmount: 10000000,
      currentAmount: 0,
      deadline: '2027-01-01',
    });
    await service.setSetting('testKey', 'testValue');
    const backup = await backups.export();
    await backups.replace(backup);
    expect((await service.snapshot()).savingsGoals[0].currentAmount).toBe(0);
    expect((await service.budgets.getAll())[0].amount).toBe(100000);
    expect(await service.getSetting('testKey')).toBe('testValue');
  });
  it('rejects bad schema, duplicate IDs/keys and orphan references without altering the database', async () => {
    const tx = entry();
    await service.saveTransaction(tx);
    const backup = await backups.export();
    expect(() => validateBackup({ ...backup, version: 2 })).toThrow();
    expect(() =>
      validateBackup({ ...backup, data: { ...backup.data, transactions: [tx, tx] } }),
    ).toThrow('ID trùng');
    expect(() =>
      validateBackup({
        ...backup,
        data: {
          ...backup.data,
          settings: [
            backup.data.settings[0],
            { ...backup.data.settings[0], id: crypto.randomUUID() },
          ],
        },
      }),
    ).toThrow('khóa cài đặt');
    await expect(
      backups.replace({ ...backup, data: { ...backup.data, accounts: [] } }),
    ).rejects.toThrow('tham chiếu');
    expect((await service.transactions.getAll())[0].id).toBe(tx.id);
  });
  it('rejects fractional money, impossible dates, and active references to deleted records', async () => {
    await service.saveTransaction(entry());
    const backup = await backups.export();
    expect(() =>
      validateBackup({
        ...backup,
        data: { ...backup.data, transactions: [{ ...backup.data.transactions[0], amount: 0.1 }] },
      }),
    ).toThrow();
    expect(() =>
      validateBackup({
        ...backup,
        data: {
          ...backup.data,
          transactions: [{ ...backup.data.transactions[0], date: '2026-02-30' }],
        },
      }),
    ).toThrow();
    expect(() =>
      validateBackup({
        ...backup,
        data: { ...backup.data, accounts: [{ ...account, deletedAt: new Date().toISOString() }] },
      }),
    ).toThrow('đã xóa');
  });
});
