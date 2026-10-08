import { useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useApp } from '../app/context';
import { filterTransactions, type TransactionFilters } from '../utils/calculations';
import { AddButton, Field, PageHeading } from '../components/ui';
import { TransactionList } from '../components/TransactionList';
const emptyFilters: TransactionFilters = {
  from: '',
  to: '',
  type: '',
  accountId: '',
  categoryId: '',
  search: '',
};
export function Transactions() {
  const { data, openEditor } = useApp();
  const [filters, setFilters] = useState(emptyFilters);
  const [expanded, setExpanded] = useState(false);
  const change = (key: keyof TransactionFilters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const transactions = filterTransactions(data.transactions, filters);
  return (
    <>
      <PageHeading
        title="Giao dịch"
        description="Mỗi khoản tiền đều có một câu chuyện."
        action={
          <AddButton onClick={() => openEditor({ kind: 'transaction' })}>Thêm giao dịch</AddButton>
        }
      />
      <section className="panel">
        <div className="filter-toolbar">
          <label className="search-input">
            <Search size={18} />
            <input
              aria-label="Tìm ghi chú"
              value={filters.search}
              onChange={(e) => change('search', e.target.value)}
              placeholder="Tìm trong ghi chú…"
            />
          </label>
          <button
            className="button secondary"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <SlidersHorizontal size={17} />
            Bộ lọc
          </button>
        </div>
        {expanded && (
          <div className="filters">
            <Field label="Từ ngày">
              <input
                type="date"
                value={filters.from}
                onChange={(e) => change('from', e.target.value)}
              />
            </Field>
            <Field label="Đến ngày">
              <input
                type="date"
                value={filters.to}
                onChange={(e) => change('to', e.target.value)}
              />
            </Field>
            <Field label="Loại">
              <select value={filters.type} onChange={(e) => change('type', e.target.value)}>
                <option value="">Tất cả</option>
                <option value="income">Thu nhập</option>
                <option value="expense">Chi tiêu</option>
                <option value="transfer">Chuyển tiền</option>
              </select>
            </Field>
            <Field label="Tài khoản">
              <select
                value={filters.accountId}
                onChange={(e) => change('accountId', e.target.value)}
              >
                <option value="">Tất cả</option>
                {data.accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Danh mục">
              <select
                value={filters.categoryId}
                onChange={(e) => change('categoryId', e.target.value)}
              >
                <option value="">Tất cả</option>
                {data.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.type === 'income' ? 'Thu' : 'Chi'})
                  </option>
                ))}
              </select>
            </Field>
            <button className="button secondary" onClick={() => setFilters(emptyFilters)}>
              Xóa bộ lọc
            </button>
            {filters.from && filters.to && filters.from > filters.to && (
              <p className="warning">Ngày bắt đầu phải trước ngày kết thúc.</p>
            )}
          </div>
        )}
        <p className="result-count muted">
          {transactions.length} giao dịch{Object.values(filters).some(Boolean) && ' · Đang lọc'}
        </p>
        <TransactionList transactions={transactions} editable />
      </section>
    </>
  );
}
