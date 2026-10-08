import { useState } from 'react';
import { useApp } from '../app/context';
import { accountBalance, expensesByCategory, monthlyTotals } from '../utils/calculations';
import { currency, currentMonth, monthLabel } from '../utils/format';
import { Empty, Field, PageHeading, Progress } from '../components/ui';
export function Reports() {
  const { data } = useApp();
  const [month, setMonth] = useState(currentMonth());
  const totals = monthlyTotals(data.transactions, month);
  const categories = expensesByCategory(data.transactions, data.categories, month);
  const [year, monthNumber] = month.split('-').map(Number);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(year, monthNumber - 1 - (5 - i), 1, 12);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { month: m, ...monthlyTotals(data.transactions, m) };
  });
  return (
    <>
      <PageHeading
        title="Báo cáo"
        description="Nhìn lại dòng tiền, để quyết định bước tiếp theo."
      />
      <div className="month-picker">
        <Field label="Tháng báo cáo">
          <input
            type="month"
            value={month}
            min="1900-06"
            max="9999-12"
            onChange={(e) => setMonth(e.target.value || currentMonth())}
          />
        </Field>
      </div>
      <div className="stat-grid">
        <section className="panel stat">
          <p className="muted">Thu nhập</p>
          <strong className="income">{currency(totals.income)}</strong>
        </section>
        <section className="panel stat">
          <p className="muted">Chi tiêu</p>
          <strong>{currency(totals.expense)}</strong>
        </section>
        <section className="panel stat">
          <p className="muted">Dòng tiền ròng</p>
          <strong className={totals.cashFlow < 0 ? 'expense' : 'income'}>
            {currency(totals.cashFlow)}
          </strong>
        </section>
      </div>
      <div className="two-columns">
        <section className="panel">
          <div className="section-heading">
            <h2>Chi tiêu theo danh mục</h2>
          </div>
          {categories.map((c) => (
            <div className="report-category" key={c.id}>
              <div className="section-heading">
                <span>{c.name}</span>
                <strong>{currency(c.amount)}</strong>
              </div>
              <Progress
                value={totals.expense ? (c.amount / totals.expense) * 100 : 0}
                label={c.name}
              />
              <small className="muted">
                {totals.expense ? Math.round((c.amount / totals.expense) * 100) : 0}% chi tiêu tháng
              </small>
            </div>
          ))}
          {!categories.length && <Empty title="Chưa có chi tiêu trong tháng" />}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Số dư tài khoản hiện tại</h2>
          </div>
          {data.accounts.map((a) => (
            <div className="summary-line" key={a.id}>
              <span>{a.name}</span>
              <strong>{currency(accountBalance(a, data.transactions))}</strong>
            </div>
          ))}
          <p className="muted page-note">
            Bao gồm số dư ban đầu và tất cả giao dịch, không giới hạn tháng báo cáo.
          </p>
        </section>
      </div>
      <section className="panel monthly-report">
        <div className="section-heading">
          <h2>Dòng tiền 6 tháng</h2>
        </div>
        <div className="table-scroll">
          <table>
            <caption className="sr-only">Thu nhập, chi tiêu và dòng tiền ròng theo tháng</caption>
            <thead>
              <tr>
                <th>Tháng</th>
                <th>Thu nhập</th>
                <th>Chi tiêu</th>
                <th>Dòng tiền ròng</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month}>
                  <th className="capitalize">{monthLabel(m.month)}</th>
                  <td className="income">{currency(m.income)}</td>
                  <td>{currency(m.expense)}</td>
                  <td className={m.cashFlow < 0 ? 'expense' : ''}>{currency(m.cashFlow)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
