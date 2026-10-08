import { useState } from 'react';
import { useApp, type Editor } from '../app/context';
import { useLocalData } from '../db/context/LocalDataProvider';
import { requestPersistence } from '../services/storage/storage';
import {
  stamp,
  type Account,
  type Budget,
  type Category,
  type SavingsGoal,
  type Transaction,
} from '../types/models';
import { parseMoney, today, currentMonth } from '../utils/format';
import { Field, FormFooter, Modal, MoneyInput, useSave } from './ui';
export const accountTypeNames = {
  cash: 'Tiền mặt',
  bank: 'Ngân hàng',
  ewallet: 'Ví điện tử',
  credit: 'Thẻ tín dụng',
  other: 'Khác',
};
type FormProps<T> = { value?: T; onDone: () => void; onClose: () => void };
export function Editors({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const { notify } = useApp();
  const props = {
    onClose,
    onDone: () => {
      notify('Đã lưu trên thiết bị.');
      void requestPersistence();
      onClose();
    },
  };
  return (
    <Modal
      title={`${editor.value ? 'Sửa' : 'Thêm'} ${{ transaction: 'giao dịch', account: 'tài khoản', category: 'danh mục', budget: 'ngân sách', goal: 'mục tiêu' }[editor.kind]}`}
      onClose={onClose}
    >
      {editor.kind === 'transaction' && <TransactionForm value={editor.value} {...props} />}
      {editor.kind === 'account' && <AccountForm value={editor.value} {...props} />}
      {editor.kind === 'category' && <CategoryForm value={editor.value} {...props} />}
      {editor.kind === 'budget' && <BudgetForm value={editor.value} {...props} />}
      {editor.kind === 'goal' && <GoalForm value={editor.value} {...props} />}
    </Modal>
  );
}
function TransactionForm({ value, onDone, onClose }: FormProps<Transaction>) {
  const { finance } = useLocalData();
  const { data } = useApp();
  const save = useSave(onDone);
  const [type, setType] = useState<Transaction['type']>(value?.type ?? 'expense');
  const [amount, setAmount] = useState(String(value?.amount ?? ''));
  const [accountId, setAccountId] = useState(value?.accountId ?? data.accounts[0]?.id ?? '');
  const [toAccountId, setToAccountId] = useState(value?.toAccountId ?? '');
  const [categoryId, setCategoryId] = useState(value?.categoryId ?? '');
  const [date, setDate] = useState(value?.date ?? today());
  const [note, setNote] = useState(value?.note ?? '');
  const submit = save.submit(async () => {
    await finance.saveTransaction(
      {
        ...(value ?? stamp()),
        type,
        amount: parseMoney(amount),
        accountId,
        ...(type === 'transfer'
          ? { toAccountId, categoryId: undefined }
          : { categoryId: categoryId || undefined, toAccountId: undefined }),
        date,
        note,
      },
      !!value,
      value,
    );
  });
  return (
    <form onSubmit={submit} className="editor-form">
      <div className="segmented" role="group" aria-label="Loại giao dịch">
        {(['expense', 'income', 'transfer'] as const).map((t) => (
          <button
            type="button"
            key={t}
            aria-pressed={type === t}
            className={type === t ? 'selected' : ''}
            onClick={() => {
              setType(t);
              setCategoryId('');
            }}
          >
            {{ expense: 'Chi tiêu', income: 'Thu nhập', transfer: 'Chuyển tiền' }[t]}
          </button>
        ))}
      </div>
      <Field label="Số tiền (VND)" hint="Nhập số nguyên, ví dụ 35000.">
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <Field label={type === 'transfer' ? 'Tài khoản chuyển' : 'Tài khoản'}>
        <select
          required
          value={accountId}
          onChange={(e) => {
            setAccountId(e.target.value);
            if (e.target.value === toAccountId) setToAccountId('');
          }}
        >
          <option value="">Chọn tài khoản</option>
          {data.accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </Field>
      {type === 'transfer' ? (
        <Field label="Tài khoản nhận">
          <select required value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
            <option value="">Chọn tài khoản nhận</option>
            {data.accounts
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
          </select>
        </Field>
      ) : (
        <Field label="Danh mục">
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Chưa phân loại</option>
            {data.categories
              .filter((c) => c.type === type)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </Field>
      )}
      <Field label="Ngày giao dịch">
        <input
          required
          type="date"
          min="1900-01-01"
          max="9999-12-31"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <Field label="Ghi chú">
        <textarea
          rows={3}
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Khoản này dành cho điều gì?"
        />
      </Field>
      {!data.accounts.length && (
        <p className="warning">Bạn cần tạo tài khoản trước khi thêm giao dịch.</p>
      )}
      <FormFooter {...save} onCancel={onClose} />
    </form>
  );
}
function AccountForm({ value, onDone, onClose }: FormProps<Account>) {
  const { finance } = useLocalData();
  const save = useSave(onDone);
  const [name, setName] = useState(value?.name ?? '');
  const [type, setType] = useState<Account['type']>(value?.type ?? 'cash');
  const [amount, setAmount] = useState(String(value?.initialBalance ?? 0));
  return (
    <form
      className="editor-form"
      onSubmit={save.submit(() =>
        finance.saveAccount(
          {
            ...(value ?? stamp()),
            name,
            type,
            initialBalance: parseMoney(amount, true),
            currency: 'VND',
          },
          !!value,
          value,
        ),
      )}
    >
      <Field label="Tên tài khoản">
        <input
          autoFocus
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ví dụ: Ngân hàng cá nhân"
        />
      </Field>
      <Field label="Loại tài khoản">
        <select value={type} onChange={(e) => setType(e.target.value as Account['type'])}>
          {Object.entries(accountTypeNames).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field
        label="Số dư ban đầu (VND)"
        hint="Có thể nhập số âm cho dư nợ. Số dư hiện tại được tính từ giao dịch."
      >
        <MoneyInput value={amount} onChange={setAmount} signed />
      </Field>
      <FormFooter {...save} onCancel={onClose} />
    </form>
  );
}
function CategoryForm({ value, onDone, onClose }: FormProps<Category>) {
  const { finance } = useLocalData();
  const save = useSave(onDone);
  const [name, setName] = useState(value?.name ?? '');
  const [type, setType] = useState<Category['type']>(value?.type ?? 'expense');
  return (
    <form
      className="editor-form"
      onSubmit={save.submit(() =>
        finance.saveCategory({ ...(value ?? stamp()), name, type }, !!value, value),
      )}
    >
      <Field label="Tên danh mục">
        <input
          autoFocus
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <Field label="Loại danh mục">
        <select
          disabled={!!value}
          value={type}
          onChange={(e) => setType(e.target.value as Category['type'])}
        >
          <option value="expense">Chi tiêu</option>
          <option value="income">Thu nhập</option>
        </select>
      </Field>
      <FormFooter {...save} onCancel={onClose} />
    </form>
  );
}
function BudgetForm({ value, onDone, onClose }: FormProps<Budget>) {
  const { finance } = useLocalData();
  const { data } = useApp();
  const save = useSave(onDone);
  const [categoryId, setCategoryId] = useState(value?.categoryId ?? '');
  const [amount, setAmount] = useState(String(value?.amount ?? ''));
  const [month, setMonth] = useState(value?.month ?? currentMonth());
  return (
    <form
      className="editor-form"
      onSubmit={save.submit(() =>
        finance.saveBudget(
          {
            ...(value ?? stamp()),
            categoryId: categoryId || undefined,
            amount: parseMoney(amount),
            period: 'monthly',
            month,
          },
          !!value,
          value,
        ),
      )}
    >
      <Field label="Tháng">
        <input
          required
          type="month"
          min="1900-01"
          max="9999-12"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </Field>
      <Field label="Danh mục ngân sách">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Tổng chi tiêu</option>
          {data.categories
            .filter((c) => c.type === 'expense')
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Hạn mức (VND)">
        <MoneyInput value={amount} onChange={setAmount} />
      </Field>
      <FormFooter {...save} onCancel={onClose} />
    </form>
  );
}
function GoalForm({ value, onDone, onClose }: FormProps<SavingsGoal>) {
  const { finance } = useLocalData();
  const save = useSave(onDone);
  const [name, setName] = useState(value?.name ?? '');
  const [target, setTarget] = useState(String(value?.targetAmount ?? ''));
  const [current, setCurrent] = useState(String(value?.currentAmount ?? 0));
  const [deadline, setDeadline] = useState(value?.deadline ?? '');
  return (
    <form
      className="editor-form"
      onSubmit={save.submit(() =>
        finance.saveGoal(
          {
            ...(value ?? stamp()),
            name,
            targetAmount: parseMoney(target),
            currentAmount: parseMoney(current),
            deadline: deadline || undefined,
          },
          !!value,
          value,
        ),
      )}
    >
      <Field label="Tên mục tiêu">
        <input
          autoFocus
          required
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ví dụ: Quỹ dự phòng"
        />
      </Field>
      <Field label="Số tiền mục tiêu (VND)">
        <MoneyInput value={target} onChange={setTarget} />
      </Field>
      <Field
        label="Số tiền hiện tại (VND)"
        hint="Ghi nhận tiến độ; không tự trừ tiền từ tài khoản."
      >
        <MoneyInput value={current} onChange={setCurrent} />
      </Field>
      <Field label="Hạn hoàn thành (tùy chọn)">
        <input
          type="date"
          min="1900-01-01"
          max="9999-12-31"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
      </Field>
      <FormFooter {...save} onCancel={onClose} />
    </form>
  );
}
