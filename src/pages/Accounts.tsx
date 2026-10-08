import { Wallet, Landmark, CreditCard, Smartphone, CircleDollarSign } from 'lucide-react';
import { useApp } from '../app/context';
import { accountBalance, sumMoney } from '../utils/calculations';
import { currency } from '../utils/format';
import { finance } from '../services/finance';
import { AddButton, Empty, PageHeading } from '../components/ui';
import { accountTypeNames } from '../components/Editors';
import { RecordActions } from '../components/RecordActions';
const icons = {
  cash: Wallet,
  bank: Landmark,
  credit: CreditCard,
  ewallet: Smartphone,
  other: CircleDollarSign,
};
export function Accounts() {
  const { data, openEditor } = useApp();
  return (
    <>
      <PageHeading
        title="Tài khoản"
        description="Theo dõi tiền mặt, ngân hàng, ví và dư nợ tại một nơi."
        action={
          <AddButton onClick={() => openEditor({ kind: 'account' })}>Thêm tài khoản</AddButton>
        }
      />
      <div className="section-heading account-total">
        <span className="muted">Tổng tài sản ròng</span>
        <strong>
          {currency(sumMoney(data.accounts.map((a) => accountBalance(a, data.transactions))))}
        </strong>
      </div>
      <div className="card-grid">
        {data.accounts.map((a) => {
          const Icon = icons[a.type];
          return (
            <section className="panel account-card" key={a.id}>
              <div className="section-heading">
                <span className="account-icon">
                  <Icon size={24} />
                </span>
                <RecordActions
                  label={`tài khoản ${a.name}`}
                  onEdit={() => openEditor({ kind: 'account', value: a })}
                  onDelete={() => finance.removeAccount(a.id)}
                />
              </div>
              <p className="muted">{accountTypeNames[a.type]}</p>
              <h2>{a.name}</h2>
              <p className="account-amount">{currency(accountBalance(a, data.transactions))}</p>
              <p className="muted">Ban đầu: {currency(a.initialBalance)}</p>
            </section>
          );
        })}
      </div>
      {!data.accounts.length && (
        <section className="panel">
          <Empty
            title="Thêm tài khoản đầu tiên"
            action={
              <AddButton onClick={() => openEditor({ kind: 'account' })}>Tạo tài khoản</AddButton>
            }
          >
            Tạo nơi ghi nhận các khoản thu và chi.
          </Empty>
        </section>
      )}
    </>
  );
}
