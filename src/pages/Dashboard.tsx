import { Link } from 'react-router-dom';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowUp,
  ChevronRight,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { useApp } from '../app/context';
import { currency, currentMonth, monthLabel } from '../utils/format';
import {
  accountBalance,
  budgetUsage,
  filterTransactions,
  monthlyTotals,
  sumMoney,
} from '../utils/calculations';
import { AddButton, Empty, PageHeading, Progress } from '../components/ui';
import { TransactionList } from '../components/TransactionList';
export function Dashboard() {
  const { data, openEditor } = useApp();
  const month = currentMonth();
  const totals = monthlyTotals(data.transactions, month);
  const assets = sumMoney(data.accounts.map((a) => accountBalance(a, data.transactions)));
  const budgets = data.budgets.filter((b) => b.month === month);
  const overall = budgets.find((b) => !b.categoryId);
  const planned = overall ? overall.amount : sumMoney(budgets.map((b) => b.amount));
  const used = overall
    ? totals.expense
    : sumMoney(budgets.map((b) => budgetUsage(b, data.transactions).used));
  const recent = filterTransactions(data.transactions, {
    from: '',
    to: '',
    type: '',
    accountId: '',
    categoryId: '',
    search: '',
  }).slice(0, 5);
  return (
    <>
      <PageHeading
        title="Một góc nhìn rõ ràng về tiền."
        description="Ghi chép nhỏ mỗi ngày, chủ động hơn với tài chính."
        action={
          <AddButton onClick={() => openEditor({ kind: 'transaction' })}>Thêm giao dịch</AddButton>
        }
      />
      <div className="dashboard-top">
        <section className="balance-card">
          <div className="balance-label">
            <Wallet size={21} />
            <span>Tổng tài sản ròng</span>
            <span className="pill">VND</span>
          </div>
          <p className="asset-amount" data-testid="total-assets">
            {currency(assets)}
          </p>
          <p className="balance-caption">Tổng số dư tài khoản, bao gồm dư nợ.</p>
          <div className="balance-footer">
            <span>
              <ShieldCheck size={16} />
              Lưu riêng trên thiết bị
            </span>
            <Link to="/accounts">
              Xem tài khoản <ChevronRight size={16} />
            </Link>
          </div>
        </section>
        <section className="panel month-summary">
          <div className="section-heading">
            <h2>Thu & chi</h2>
            <span className="muted capitalize">{monthLabel(month)}</span>
          </div>
          <div className="summary-line">
            <span className="small-icon income">
              <ArrowDownLeft size={19} />
            </span>
            <span>Thu nhập</span>
            <strong className="income" data-testid="monthly-income">
              {currency(totals.income)}
            </strong>
          </div>
          <div className="summary-line">
            <span className="small-icon expense">
              <ArrowUpRight size={19} />
            </span>
            <span>Chi tiêu</span>
            <strong data-testid="monthly-expense">{currency(totals.expense)}</strong>
          </div>
          <div className="summary-net">
            <span>Số dư trong tháng</span>
            <strong>{currency(totals.cashFlow)}</strong>
          </div>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="section-heading">
            <h2>Giao dịch gần đây</h2>
            <Link className="text-link" to="/transactions">
              Xem tất cả <ChevronRight size={16} />
            </Link>
          </div>
          <TransactionList transactions={recent} />
        </section>
        <div className="dashboard-aside">
          <section className="panel">
            <div className="section-heading">
              <h2>Ngân sách tháng</h2>
              <Link to="/budgets" aria-label="Xem ngân sách">
                <ChevronRight size={18} />
              </Link>
            </div>
            {planned ? (
              <>
                <div className="budget-numbers">
                  <strong>{currency(used)}</strong>
                  <span className="muted">/ {currency(planned)}</span>
                </div>
                <Progress value={(used / planned) * 100} label="Ngân sách đã sử dụng" />
                <p className={used > planned ? 'expense' : 'muted'}>
                  {Math.round((used / planned) * 100)}% đã dùng ·{' '}
                  {used > planned ? 'Đã vượt hạn mức' : `Còn ${currency(planned - used)}`}
                </p>
                <small className="muted">
                  {overall ? 'Tất cả chi tiêu trong tháng.' : 'Tổng các danh mục có ngân sách.'}
                </small>
              </>
            ) : (
              <Empty title="Đặt một hạn mức">
                Bắt đầu với ngân sách chi tiêu tháng này.
                <Link to="/budgets" className="text-link">
                  Tạo ngân sách <ArrowUp size={16} />
                </Link>
              </Empty>
            )}
          </section>
          <section className="local-note">
            <ShieldCheck size={25} />
            <div>
              <h3>Tiền của bạn. Dữ liệu của bạn.</h3>
              <p>
                Lưu trên trình duyệt, dùng được offline. Hãy sao lưu thường xuyên để bảo vệ những
                ghi chép của bạn.
              </p>
              <Link to="/settings">
                Sao lưu dữ liệu <ChevronRight size={15} />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
