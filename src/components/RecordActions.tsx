import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../app/context';
import { errorMessage } from '../utils/format';
export function RecordActions({
  label,
  onEdit,
  onDelete,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => Promise<void>;
}) {
  const { notify } = useApp();
  const [busy, setBusy] = useState(false);
  return (
    <div className="record-actions">
      <button className="icon-button" aria-label={`Sửa ${label}`} onClick={onEdit}>
        <Pencil size={17} />
      </button>
      <button
        className="icon-button danger"
        disabled={busy}
        aria-label={`Xóa ${label}`}
        onClick={async () => {
          if (!window.confirm(`Xóa ${label}? Bản ghi sẽ được xóa mềm.`)) return;
          setBusy(true);
          try {
            await onDelete();
            notify('Đã xóa bản ghi.');
          } catch (err) {
            notify(errorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Trash2 size={17} />
      </button>
    </div>
  );
}
