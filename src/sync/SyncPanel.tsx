import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocalData } from '../db/context/LocalDataProvider';
import { useAuth } from '../auth/AuthProvider';
import { ErrorNotice } from '../components/ui';
import { downloadBackup } from '../services/backup/backup';
import { errorMessage, today } from '../utils/format';
import type { DomainRecord } from './syncTypes';
const labels: Record<string, string> = {
  name: 'Tên',
  type: 'Loại',
  initialBalance: 'Số dư ban đầu',
  currency: 'Tiền tệ',
  amount: 'Số tiền',
  accountId: 'Tài khoản',
  toAccountId: 'Tài khoản nhận',
  categoryId: 'Danh mục',
  date: 'Ngày',
  note: 'Ghi chú',
  period: 'Chu kỳ',
  month: 'Tháng',
  targetAmount: 'Mục tiêu',
  currentAmount: 'Đã tiết kiệm',
  deadline: 'Hạn mục tiêu',
  deletedAt: 'Đã xóa',
};
const names: Record<string, string> = {
  accounts: 'Tài khoản',
  categories: 'Danh mục',
  transactions: 'Giao dịch',
  budgets: 'Ngân sách',
  savingsGoals: 'Mục tiêu',
};
function RecordSummary({ record }: { record: DomainRecord | null }) {
  return record ? (
    <dl className="conflict-record">
      {Object.entries(record)
        .filter(([key, value]) => labels[key] && value !== null)
        .map(([key, value]) => (
          <div key={key}>
            <dt>{labels[key]}</dt>
            <dd>
              {typeof value === 'number' ? `${value.toLocaleString('vi-VN')} ₫` : String(value)}
            </dd>
          </div>
        ))}
    </dl>
  ) : (
    <p>Cloud chưa có bản ghi này.</p>
  );
}
export function SyncPanel() {
  const { coordinator } = useLocalData();
  return coordinator ? <CloudPanel /> : null;
}
function CloudPanel() {
  const { db, engine, coordinator, bootstrap } = useLocalData();
  const auth = useAuth();
  const state = useSyncExternalStore(coordinator!.subscribe, coordinator!.getSnapshot);
  const local = useLiveQuery(
    async () => ({
      pending: await db.syncQueue.count(),
      conflicts: await db.syncConflicts.toArray(),
      last: (await db.syncState.get('lastSync'))?.value,
      ready: (await db.syncState.get('ready'))?.value === 'true',
      legacy: !!(await db.syncState.get('legacySource')),
    }),
    [db],
  );
  const [inspection, setInspection] =
    useState<Awaited<ReturnType<NonNullable<typeof bootstrap>['inspect']>>>();
  const [confirmed, setConfirmed] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (!local || local.ready || !auth.user) return;
    const stop = new AbortController();
    void bootstrap!
      .inspect(stop.signal)
      .then(setInspection)
      .catch(() => {
        if (!stop.signal.aborted)
          setError(
            'Chưa kiểm tra được dữ liệu cloud. Kiểm tra kết nối, đăng nhập và cấu hình database.',
          );
      });
    return () => stop.abort();
  }, [bootstrap, local?.ready, auth.user?.id]);
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await work();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const status = !state.authorized
    ? 'Cần đăng nhập lại để đồng bộ'
    : !state.online
      ? 'Offline — thay đổi được giữ trên thiết bị'
      : state.running
        ? 'Đang đồng bộ…'
        : state.error
          ? 'Đồng bộ gặp lỗi'
          : local?.conflicts.length
            ? 'Có thay đổi cần xử lý'
            : local?.pending
              ? 'Có thay đổi chưa đồng bộ'
              : local?.ready
                ? 'Đã đồng bộ'
                : 'Chưa thiết lập đồng bộ';
  return (
    <section className="panel sync-panel" aria-label="Đồng bộ dữ liệu">
      <h2>Đồng bộ dữ liệu</h2>
      <p role="status">{status}</p>
      <p className="muted">
        {local?.pending ?? 0} thay đổi chờ gửi · {local?.conflicts.length ?? 0} xung đột
      </p>
      <p className="muted">
        {local?.last
          ? `Lần thành công: ${new Date(local.last).toLocaleString('vi-VN')}`
          : 'Chưa có lần đồng bộ thành công.'}
      </p>
      <ErrorNotice message={error || state.error} />
      {local?.ready ? (
        <div className="settings-buttons">
          <button
            className="button primary"
            disabled={state.running || !state.authorized || !state.online}
            onClick={() => coordinator!.request(true)}
          >
            Đồng bộ ngay
          </button>
          {local.legacy && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => downloadBackup(await bootstrap!.exportLegacy(), today()))
              }
            >
              Sao lưu sổ local cũ
            </button>
          )}
        </div>
      ) : (
        <>
          <p>
            Chọn sổ dữ liệu cho tài khoản này. Sổ local cũ được giữ riêng để sao lưu; các tài khoản
            cloud khác sẽ không nhìn thấy nó. Không tự gộp theo tên.
          </p>
          {inspection?.legacy && (
            <p>
              Sổ local được giữ: {inspection.legacy.accounts} tài khoản,{' '}
              {inspection.legacy.transactions} giao dịch.
            </p>
          )}
          {inspection && (
            <p>
              {inspection.initialized
                ? 'Cloud đã có sổ dữ liệu. Dùng bản cloud sẽ tải vào hồ sơ riêng, giữ nguyên nguồn local cũ.'
                : 'Cloud chưa có sổ dữ liệu. Bạn có thể tải sổ local lên hoặc bắt đầu sổ trống.'}
            </p>
          )}
          <div className="settings-buttons">
            <button
              className="button secondary"
              disabled={busy || !auth.user || !state.online}
              onClick={() => void run(async () => setInspection(await bootstrap!.inspect()))}
            >
              Kiểm tra cloud
            </button>
            {local?.legacy && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => downloadBackup(await bootstrap!.exportLegacy(), today()))
                }
              >
                Sao lưu sổ local cũ
              </button>
            )}
          </div>
          {inspection && (
            <>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                Tôi đã kiểm tra nguồn dữ liệu và muốn dùng lựa chọn bên dưới.
              </label>
              <div className="settings-buttons">
                {inspection.initialized ? (
                  <button
                    className="button primary"
                    disabled={!confirmed || busy || !auth.user}
                    onClick={() =>
                      void run(async () => {
                        await bootstrap!.start('download');
                        coordinator!.request(true);
                      })
                    }
                  >
                    Dùng dữ liệu cloud
                  </button>
                ) : (
                  <>
                    {inspection.legacy && (
                      <button
                        className="button primary"
                        disabled={!confirmed || busy || !auth.user}
                        onClick={() =>
                          void run(async () => {
                            await bootstrap!.start('upload');
                            coordinator!.request(true);
                          })
                        }
                      >
                        Tải sổ local lên cloud
                      </button>
                    )}
                    <button
                      className="button secondary"
                      disabled={!confirmed || busy || !auth.user}
                      onClick={() =>
                        void run(async () => {
                          await bootstrap!.start('empty');
                          coordinator!.request(true);
                        })
                      }
                    >
                      Bắt đầu sổ cloud trống
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          <p className="muted">
            Bạn có thể đăng xuất để dùng sổ local riêng. Thao tác này không xóa sổ cũ hoặc các thay
            đổi chưa gửi.
          </p>
        </>
      )}
      {!!local?.conflicts.length && (
        <div className="conflicts">
          <h3>Thay đổi cần bạn xử lý</h3>
          <p>
            Chọn toàn bộ bản muốn giữ. Nếu bạn vừa sửa lại dữ liệu trên thiết bị, “Giữ bản trên
            thiết bị” sẽ gửi bản đã sửa đó.
          </p>
          {local.conflicts.map((c) => (
            <details key={c.id} className="conflict">
              <summary>
                {names[c.entityType]} ·{' '}
                {c.reason === 'reference'
                  ? 'Tham chiếu cần kiểm tra'
                  : c.reason === 'validation'
                    ? 'Cloud từ chối dữ liệu'
                    : 'Hai thiết bị cùng sửa'}
              </summary>
              <div className="two-columns">
                <section>
                  <h4>Bản trên thiết bị lúc phát hiện</h4>
                  <RecordSummary record={c.localData} />
                </section>
                <section>
                  <h4>Bản cloud</h4>
                  <RecordSummary record={c.remoteData} />
                </section>
              </div>
              <div className="settings-buttons">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await engine!.resolve(c.id, 'local');
                      coordinator!.request(true);
                    })
                  }
                >
                  Giữ bản trên thiết bị
                </button>
                <button
                  className="button secondary"
                  disabled={busy || !c.remoteData}
                  onClick={() =>
                    void run(async () => {
                      await engine!.resolve(c.id, 'cloud');
                      coordinator!.request(true);
                    })
                  }
                >
                  Giữ bản cloud
                </button>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
