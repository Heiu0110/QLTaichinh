import { z } from 'zod';
import {
  accountSchema,
  budgetSchema,
  categorySchema,
  goalSchema,
  settingSchema,
  transactionSchema,
  type FinanceData,
} from '../../types/models';
import { database, type FinanceDatabase } from '../../db/database';
import { sumMoney } from '../../utils/calculations';
const rows = <T extends z.ZodType>(schema: T) => z.array(schema).max(100_000);
export const backupSchema = z
  .object({
    app: z.literal('sotien'),
    version: z.literal(1),
    exportedAt: z.iso.datetime(),
    data: z
      .object({
        accounts: rows(accountSchema),
        transactions: rows(transactionSchema),
        categories: rows(categorySchema),
        budgets: rows(budgetSchema),
        savingsGoals: rows(goalSchema),
        settings: rows(settingSchema),
      })
      .strict(),
  })
  .strict();
export type Backup = z.infer<typeof backupSchema>;
export function validateBackup(input: unknown): Backup {
  const result = backupSchema.safeParse(input);
  if (!result.success)
    throw new Error('Backup không đúng định dạng Sổ tiền V1, hoặc có số tiền / ngày không hợp lệ.');
  const backup = result.data;
  for (const records of Object.values(backup.data)) {
    if (new Set(records.map((r) => r.id)).size !== records.length)
      throw new Error('Backup chứa ID trùng nhau.');
  }
  const { accounts, categories, transactions, budgets, settings, savingsGoals } = backup.data;
  if (new Set(settings.map((s) => s.key)).size !== settings.length)
    throw new Error('Backup chứa khóa cài đặt trùng nhau.');
  const accountMap = new Map(accounts.map((a) => [a.id, a]));
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  for (const t of transactions) {
    const source = accountMap.get(t.accountId);
    const target = t.toAccountId ? accountMap.get(t.toAccountId) : undefined;
    const category = t.categoryId ? categoryMap.get(t.categoryId) : undefined;
    if (
      !source ||
      (t.toAccountId && !target) ||
      (t.categoryId && (!category || category.type !== t.type))
    )
      throw new Error('Backup có giao dịch tham chiếu tài khoản hoặc danh mục không hợp lệ.');
    if (!t.deletedAt && (source.deletedAt || target?.deletedAt || category?.deletedAt))
      throw new Error('Giao dịch đang hoạt động tham chiếu bản ghi đã xóa.');
  }
  const budgetKeys = new Set<string>();
  for (const b of budgets) {
    const category = b.categoryId ? categoryMap.get(b.categoryId) : undefined;
    if (
      b.categoryId &&
      (!category || category.type !== 'expense' || (!b.deletedAt && category.deletedAt))
    )
      throw new Error('Backup có ngân sách tham chiếu danh mục không hợp lệ.');
    const key = `${b.month}:${b.categoryId ?? ''}`;
    if (!b.deletedAt && budgetKeys.has(key))
      throw new Error('Backup có ngân sách trùng tháng và danh mục.');
    if (!b.deletedAt) budgetKeys.add(key);
  }
  // A conservative bound guarantees all integer aggregates remain exactly representable.
  sumMoney([
    ...accounts.map((a) => Math.abs(a.initialBalance)),
    ...transactions.map((t) => t.amount),
    ...budgets.map((b) => b.amount),
    ...savingsGoals.flatMap((g) => [g.targetAmount, g.currentAmount]),
  ]);
  return backup;
}
export class BackupService {
  constructor(private db: FinanceDatabase) {}
  async export(): Promise<Backup> {
    return this.db.transaction('r', this.db.tables, async () => {
      const data: FinanceData = {
        accounts: await this.db.accounts.toArray(),
        categories: await this.db.categories.toArray(),
        transactions: await this.db.transactions.toArray(),
        budgets: await this.db.budgets.toArray(),
        savingsGoals: await this.db.savingsGoals.toArray(),
        settings: await this.db.settings.toArray(),
      };
      return validateBackup({
        app: 'sotien',
        version: 1,
        exportedAt: new Date().toISOString(),
        data,
      });
    });
  }
  async replace(input: unknown) {
    if (this.db.cloud)
      throw new Error(
        'Không thể thay toàn bộ dữ liệu của hồ sơ cloud. Đăng xuất và khôi phục vào sổ local riêng.',
      );
    const backup = validateBackup(input);
    await this.db.transaction('rw', this.db.tables, async () => {
      await this.db.assertWritable();
      for (const name of [
        'accounts',
        'categories',
        'transactions',
        'budgets',
        'savingsGoals',
        'settings',
      ] as const) {
        const table = this.db.table(name);
        await table.clear();
        await table.bulkAdd(backup.data[table.name as keyof FinanceData]);
      }
    });
  }
}
export const backupService = new BackupService(database);
export async function readBackup(file: File) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Backup vượt giới hạn 20 MB.');
  let content: unknown;
  try {
    content = JSON.parse(await file.text());
  } catch {
    throw new Error('Không đọc được file JSON.');
  }
  return validateBackup(content);
}
export function downloadBackup(backup: Backup, date: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = `finance-backup-${date}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
