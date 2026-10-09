import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { X, Plus, LoaderCircle, AlertCircle } from 'lucide-react';
import { errorMessage } from '../utils/format';
export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <p className="eyebrow">TÀI CHÍNH CÁ NHÂN</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </header>
  );
}
export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button className="button primary" onClick={onClick}>
      <Plus size={18} />
      {children}
    </button>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-mark">＋</span>
      <h3>{title}</h3>
      <p className="muted">{children}</p>
      {action}
    </div>
  );
}
export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className={`progress ${value > 100 ? 'over' : ''}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(Math.min(100, Math.max(0, value)))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      el?.close();
      document.body.style.overflow = before;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id="modal-title">{title}</h2>
        <button className="icon-button" aria-label="Đóng" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement<{ id?: string }>(children) ? cloneElement(children, { id }) : children}
      {hint && <small className="muted">{hint}</small>}
    </div>
  );
}
export function useSave(onDone: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = (task: () => Promise<void>) => async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await task();
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, submit };
}
export function FormFooter({
  busy,
  error,
  onCancel,
  disabled = false,
}: {
  busy: boolean;
  error: string;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      <ErrorNotice message={error} />
      <div className="form-footer">
        <button type="button" className="button secondary" onClick={onCancel} disabled={busy}>
          Hủy
        </button>
        <button className="button primary" type="submit" disabled={busy || disabled}>
          {busy && <LoaderCircle size={18} className="spin" />}
          {busy ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </>
  );
}
export function ErrorNotice({ message }: { message: string }) {
  return message ? (
    <div className="error-notice" role="alert">
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  ) : null;
}
export function MoneyInput({
  value,
  onChange,
  signed = false,
  id,
}: {
  value: string;
  onChange: (value: string) => void;
  signed?: boolean;
  id?: string;
}) {
  return (
    <input
      id={id}
      required
      inputMode={signed ? 'text' : 'numeric'}
      type="text"
      pattern={signed ? '-?[0-9]+' : '[0-9]+'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={14}
      placeholder="0"
    />
  );
}
