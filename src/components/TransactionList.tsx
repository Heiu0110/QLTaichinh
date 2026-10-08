import { ArrowDownLeft, ArrowUpRight, ArrowRightLeft } from 'lucide-react';
import { useApp } from '../app/context';
import { type Transaction } from '../types/models';
import { currency, dateLabel } from '../utils/format';
import { useLocalData } from '../db/context/LocalDataProvider';
import { RecordActions } from './RecordActions';
import { Empty } from './ui';
export function TransactionList({
  transactions,
  editable = false,
}: {
  transactions: Transaction[];
  editable?: boolean;
}) {
  const { finance } = useLocalData();
  const { data, openEditor } = useApp();
  if (!transactions.length)
    return <Empty title="Chưa có giao dịch">Những khoản thu và chi sẽ xuất hiện ở đây.</Empty>;
  return (
    <div className="transaction-list">
      {transactions.map((t) => {
        const category = data.categories.find((c) => c.id === t.categoryId);
        const account = data.accounts.find((a) => a.id === t.accountId);
        const target = data.accounts.find((a) => a.id === t.toAccountId);
        const name =
          t.type === 'transfer'
            ? 'Chuyển tiền'
            : (category?.name ?? (t.type === 'income' ? 'Thu nhập' : 'Chi tiêu'));
        const Icon =
          t.type === 'income'
            ? ArrowDownLeft
            : t.type === 'expense'
              ? ArrowUpRight
              : ArrowRightLeft;
        return (
          <article key={t.id} className="transaction-row" data-testid="transaction-row">
            <div className={`transaction-icon ${t.type}`}>
              <Icon size={19} />
            </div>
            <div className="transaction-description">
              <strong>{name}</strong>
              <p className="muted">
                {account?.name}
                {target && ` → ${target.name}`} · {dateLabel(t.date)}
              </p>
              {t.note && <p className="transaction-note">{t.note}</p>}
            </div>
            <div className={`transaction-amount ${t.type}`}>
              {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}
              {currency(t.amount)}
            </div>
            {editable && (
              <RecordActions
                label={`giao dịch ${t.note || name}`}
                onEdit={() => openEditor({ kind: 'transaction', value: t })}
                onDelete={() => finance.transactions.remove(t.id)}
              />
            )}
          </article>
        );
      })}
    </div>
  );
}
