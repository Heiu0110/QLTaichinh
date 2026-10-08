import { Flag } from 'lucide-react';
import { useApp } from '../app/context';
import { useLocalData } from '../db/context/LocalDataProvider';
import { currency, dateLabel, today } from '../utils/format';
import { AddButton, Empty, PageHeading, Progress } from '../components/ui';
import { RecordActions } from '../components/RecordActions';
export function Savings() {
  const { finance } = useLocalData();
  const { data, openEditor } = useApp();
  return (
    <>
      <PageHeading
        title="Mục tiêu tiết kiệm"
        description="Từng khoản nhỏ, gần hơn với điều bạn muốn."
        action={<AddButton onClick={() => openEditor({ kind: 'goal' })}>Thêm mục tiêu</AddButton>}
      />
      <p className="muted page-note">
        Tiến độ được ghi nhận thủ công và không thay đổi số dư tài khoản.
      </p>
      <div className="card-grid">
        {data.savingsGoals.map((g) => {
          const percentage = (g.currentAmount / g.targetAmount) * 100;
          return (
            <section className="panel" key={g.id}>
              <div className="section-heading">
                <span className="account-icon">
                  <Flag size={22} />
                </span>
                <RecordActions
                  label={`mục tiêu ${g.name}`}
                  onEdit={() => openEditor({ kind: 'goal', value: g })}
                  onDelete={() => finance.savingsGoals.remove(g.id)}
                />
              </div>
              <h2>{g.name}</h2>
              <div className="budget-numbers">
                <strong>{currency(g.currentAmount)}</strong>
                <span className="muted">/ {currency(g.targetAmount)}</span>
              </div>
              <Progress value={percentage} label={`Mục tiêu ${g.name}`} />
              <div className="section-heading budget-foot">
                <span className="muted">
                  {g.deadline ? `Hạn: ${dateLabel(g.deadline)}` : 'Không đặt thời hạn'}
                </span>
                <strong>{Math.round(percentage)}%</strong>
              </div>
              {percentage >= 100 ? (
                <p className="income">Đã đạt mục tiêu!</p>
              ) : g.deadline && g.deadline < today() ? (
                <p className="expense">Đã qua hạn · Bạn có thể điều chỉnh mục tiêu.</p>
              ) : null}
            </section>
          );
        })}
      </div>
      {!data.savingsGoals.length && (
        <section className="panel">
          <Empty
            title="Bạn đang dành dụm cho điều gì?"
            action={
              <AddButton onClick={() => openEditor({ kind: 'goal' })}>Tạo mục tiêu</AddButton>
            }
          >
            Quỹ dự phòng, chuyến đi hay một khởi đầu mới.
          </Empty>
        </section>
      )}
    </>
  );
}
