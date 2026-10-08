import { z } from 'zod';
import { isCalendarDate } from '../utils/format';
const metadata = {
  id: z.uuid(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  deletedAt: z.iso.datetime().nullable().default(null),
};
const money = z.number().int().min(-1_000_000_000_000).max(1_000_000_000_000);
const name = z.string().trim().min(1).max(80);
const date = z.string().refine(isCalendarDate, 'Ngày không hợp lệ');
export const monthSchema = z.string().regex(/^(19\d{2}|[2-9]\d{3})-(0[1-9]|1[0-2])$/);
export const accountSchema = z
  .object({
    ...metadata,
    name,
    type: z.enum(['cash', 'bank', 'ewallet', 'credit', 'other']),
    initialBalance: money,
    currency: z.literal('VND'),
  })
  .strict();
export const categorySchema = z
  .object({
    ...metadata,
    name,
    type: z.enum(['income', 'expense']),
    icon: z.string().max(30).optional(),
  })
  .strict();
export const transactionSchema = z
  .object({
    ...metadata,
    type: z.enum(['income', 'expense', 'transfer']),
    amount: money.positive(),
    accountId: z.uuid(),
    toAccountId: z.uuid().optional(),
    categoryId: z.uuid().optional(),
    date,
    note: z.string().trim().max(500).optional(),
  })
  .strict()
  .superRefine((t, ctx) => {
    if (t.type === 'transfer' && (!t.toAccountId || t.toAccountId === t.accountId || t.categoryId))
      ctx.addIssue({
        code: 'custom',
        message: 'Chuyển tiền cần hai tài khoản khác nhau và không dùng danh mục.',
      });
    if (t.type !== 'transfer' && t.toAccountId)
      ctx.addIssue({ code: 'custom', message: 'Chỉ chuyển tiền mới có tài khoản nhận.' });
  });
export const budgetSchema = z
  .object({
    ...metadata,
    categoryId: z.uuid().optional(),
    amount: money.positive(),
    period: z.literal('monthly'),
    month: monthSchema,
  })
  .strict();
export const goalSchema = z
  .object({
    ...metadata,
    name,
    targetAmount: money.positive(),
    currentAmount: money.nonnegative(),
    deadline: date.optional(),
  })
  .strict();
export const settingSchema = z
  .object({ ...metadata, key: z.string().min(1).max(80), value: z.string().max(1000) })
  .strict();
export type Account = z.infer<typeof accountSchema>;
export type Category = z.infer<typeof categorySchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Budget = z.infer<typeof budgetSchema>;
export type SavingsGoal = z.infer<typeof goalSchema>;
export type Setting = z.infer<typeof settingSchema>;
export type Entity = Account | Category | Transaction | Budget | SavingsGoal | Setting;
export interface FinanceData {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  savingsGoals: SavingsGoal[];
  settings: Setting[];
}
export const stamp = () => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null,
});
export const active = <T extends { deletedAt?: string | null }>(records: T[]) =>
  records.filter((record) => !record.deletedAt);
