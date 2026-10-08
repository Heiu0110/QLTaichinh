import {
  active,
  type Account,
  type Budget,
  type Category,
  type Transaction,
} from '../types/models';
export function sumMoney(values: number[]) {
  return values.reduce((sum, value) => {
    const result = sum + value;
    if (!Number.isSafeInteger(result)) throw new Error('Tổng số tiền vượt giới hạn an toàn.');
    return result;
  }, 0);
}
export function accountBalance(account: Account, transactions: Transaction[]) {
  const movements = active(transactions).flatMap((t) => {
    const parts: number[] = [];
    if (t.accountId === account.id) parts.push(t.type === 'income' ? t.amount : -t.amount);
    if (t.type === 'transfer' && t.toAccountId === account.id) parts.push(t.amount);
    return parts;
  });
  return sumMoney([account.initialBalance, ...movements]);
}
export function monthlyTotals(transactions: Transaction[], month: string) {
  const records = active(transactions).filter((t) => t.date.slice(0, 7) === month);
  const income = sumMoney(records.filter((t) => t.type === 'income').map((t) => t.amount));
  const expense = sumMoney(records.filter((t) => t.type === 'expense').map((t) => t.amount));
  return { income, expense, cashFlow: sumMoney([income, -expense]) };
}
export function categoryTotal(transactions: Transaction[], month: string, categoryId?: string) {
  return sumMoney(
    active(transactions)
      .filter(
        (t) =>
          t.type === 'expense' &&
          t.date.slice(0, 7) === month &&
          (!categoryId || t.categoryId === categoryId),
      )
      .map((t) => t.amount),
  );
}
export function budgetUsage(budget: Budget, transactions: Transaction[]) {
  const used = categoryTotal(transactions, budget.month, budget.categoryId);
  return {
    used,
    percentage: budget.amount > 0 ? (used / budget.amount) * 100 : 0,
    remaining: sumMoney([budget.amount, -used]),
  };
}
export function expensesByCategory(
  transactions: Transaction[],
  categories: Category[],
  month: string,
) {
  const totals = new Map<string, number>();
  for (const t of active(transactions))
    if (t.type === 'expense' && t.date.startsWith(month + '-'))
      totals.set(t.categoryId ?? '', sumMoney([totals.get(t.categoryId ?? '') ?? 0, t.amount]));
  return [...totals]
    .map(([id, amount]) => ({
      id,
      name: categories.find((c) => c.id === id)?.name ?? 'Chưa phân loại',
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
}
export interface TransactionFilters {
  from: string;
  to: string;
  type: string;
  accountId: string;
  categoryId: string;
  search: string;
}
export function filterTransactions(transactions: Transaction[], filters: TransactionFilters) {
  return active(transactions)
    .filter(
      (t) =>
        (!filters.from || t.date >= filters.from) &&
        (!filters.to || t.date <= filters.to) &&
        (!filters.type || t.type === filters.type) &&
        (!filters.accountId ||
          t.accountId === filters.accountId ||
          t.toAccountId === filters.accountId) &&
        (!filters.categoryId || t.categoryId === filters.categoryId) &&
        (!filters.search ||
          t.note?.toLocaleLowerCase('vi').includes(filters.search.toLocaleLowerCase('vi'))),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) ||
        b.createdAt.localeCompare(a.createdAt) ||
        a.id.localeCompare(b.id),
    );
}
