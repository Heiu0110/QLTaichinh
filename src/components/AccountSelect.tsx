import { useEffect, useId, useRef, useState } from 'react';
import { Check, ChevronDown, Wallet } from 'lucide-react';
import type { AccountChoice } from '../utils/bankAccounts';

// An in-page list keeps logos visible on mobile, unlike native <option> elements.
export function AccountSelect({
  id,
  value,
  options,
  disabledId,
  placeholder = 'Chọn tài khoản',
  onChange,
}: {
  id?: string;
  value: string;
  options: AccountChoice[];
  disabledId?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  const listId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(value);
  const selected = options.find((option) => option.id === value);
  const available = options.filter((option) => option.id !== disabledId);
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const mark = (option?: AccountChoice) =>
    option?.logo ? (
      <img src={option.logo} alt="" width="68" height="28" />
    ) : (
      <Wallet size={20} aria-hidden="true" />
    );
  return (
    <div
      className="account-select"
      ref={ref}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        id={id}
        ref={trigger}
        type="button"
        className="account-select-trigger"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-activedescendant={
          open && available.some((o) => o.id === active) ? `${listId}-${active}` : undefined
        }
        onClick={() => {
          setActive(value || available[0]?.id || '');
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            event.stopPropagation();
            setOpen(false);
          } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
            const index = available.findIndex((o) => o.id === (open ? active : value));
            const next =
              event.key === 'Home'
                ? 0
                : event.key === 'End'
                  ? available.length - 1
                  : (index + (event.key === 'ArrowDown' ? 1 : -1) + available.length) %
                    available.length;
            setActive(available[next]?.id ?? '');
          } else if (open && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            if (available.some((o) => o.id === active)) choose(active);
          }
        }}
      >
        {mark(selected)}
        <span>{selected?.name ?? placeholder}</span>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <div id={listId} role="listbox" aria-labelledby={id} className="account-select-options">
          {options.map((option) => (
            <button
              key={option.id}
              id={`${listId}-${option.id}`}
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={value === option.id}
              aria-disabled={option.id === disabledId}
              disabled={option.id === disabledId}
              className={active === option.id ? 'active' : ''}
              onPointerMove={() => {
                if (option.id !== disabledId) setActive(option.id);
              }}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(option.id)}
            >
              {mark(option)}
              <span>{option.name}</span>
              {value === option.id && <Check size={18} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
