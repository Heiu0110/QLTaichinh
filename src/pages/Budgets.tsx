import { useState } from 'react';
import { useApp } from '../app/context';
import { finance } from '../services/finance';
import { budgetUsage } from '../utils/calculations';
import { currency, currentMonth } from '../utils/format';
import { AddButton, Empty, Field, PageHeading, Progress } from '../components/ui';
import { RecordActions } from '../components/RecordActions';
export function Budgets() {
  const { data, openEditor } = useApp();
  const [month, setMonth] = useState(currentMonth());
  const budgets = data.budgets.filter((b) => b.month === month);
  return (
    <>
      <PageHeading
        title="Ngân sách"
        description="Một hạn mức vừa đủ, cho những điều quan trọng."
        action={
          <AddButton onClick={() => openEditor({ kind: 'budget' })}>Thêm ngân sách</AddButton>
        }
      />
      <div className="month-picker">
        <Field label="Tháng ngân sách">
          <input
            type="month"
            min="1900-01"
            max="9999-12"
            value={month}
            onChange={(e) => setMonth(e.target.value || currentMonth())}
          />
        </Field>
      </div>
      <div className="card-grid">
        {budgets.map((b) => {
          const usage = budgetUsage(b, data.transactions);
          const name = data.categories.find((c) => c.id === b.categoryId)?.name ?? 'Tổng chi tiêu';
          return (
            <section className="panel" key={b.id}>
              <div className="section-heading">
                <h2>{name}</h2>
                <RecordActions
                  label={`ngân sách ${name}`}
                  onEdit={() => openEditor({ kind: 'budget', value: b })}
                  onDelete={() => finance.budgets.remove(b.id)}
                />
              </div>
              <div className="budget-numbers">
                <strong>{currency(usage.used)}</strong>
                <span className="muted">/ {currency(b.amount)}</span>
              </div>
              <Progress value={usage.percentage} label={`Ngân sách ${name}`} />
              <div className="section-heading budget-foot">
                <span className={usage.remaining < 0 ? 'expense' : 'muted'}>
                  {usage.remaining < 0
                    ? `Vượt ${currency(-usage.remaining)}`
                    : `Còn ${currency(usage.remaining)}`}
                </span>
                <strong>{Math.round(usage.percentage)}%</strong>
              </div>
            </section>
          );
        })}
      </div>
      {!budgets.length && (
        <section className="panel">
          <Empty
            title="Tháng này chưa có ngân sách"
            action={
              <AddButton onClick={() => openEditor({ kind: 'budget' })}>Đặt hạn mức</AddButton>
            }
          >
            Đặt ngân sách tổng hoặc theo từng danh mục.
          </Empty>
        </section>
      )}
    </>
  );
}
