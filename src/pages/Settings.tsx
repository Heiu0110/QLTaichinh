import { SyncPanel } from '../sync/SyncPanel';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  Upload,
  ShieldCheck,
  Smartphone,
  ChevronRight,
  Database,
  Wallet,
  Tags,
  Flag,
  ChartNoAxesCombined,
} from 'lucide-react';
import { useApp } from '../app/context';
import { AuthPanel } from '../auth/AuthPanel';
import { downloadBackup, readBackup, type Backup } from '../services/backup/backup';
import { requestPersistence, storageStatus } from '../services/storage/storage';
import { useLocalData } from '../db/context/LocalDataProvider';
import { errorMessage, today } from '../utils/format';
import { ErrorNotice, Modal, PageHeading } from '../components/ui';
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function Settings({ offlineReady }: { offlineReady: boolean }) {
  const { data, notify } = useApp();
  const { finance, backupService, db } = useLocalData();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [backup, setBackup] = useState<Backup>();
  const [confirmed, setConfirmed] = useState(false);
  const [storage, setStorage] = useState('Đang kiểm tra…');
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt>();
  const [installed, setInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches,
  );
  const fileInput = useRef<HTMLInputElement>(null);
  const lastBackup = data.settings.find((s) => s.key === 'lastBackup')?.value;
  const refreshStorage = async () => {
    const status = await storageStatus();
    setStorage(
      status === 'persistent'
        ? 'Đã được cấp lưu trữ bền vững'
        : status === 'temporary'
          ? 'Lưu trữ thông thường'
          : 'Trình duyệt chưa hỗ trợ kiểm tra',
    );
  };
  useEffect(() => {
    void refreshStorage();
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(undefined);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const links = [
    { to: '/accounts', name: 'Tài khoản', icon: Wallet },
    { to: '/categories', name: 'Danh mục', icon: Tags },
    { to: '/savings', name: 'Mục tiêu tiết kiệm', icon: Flag },
    { to: '/reports', name: 'Báo cáo', icon: ChartNoAxesCombined },
  ];
  return (
    <>
      <PageHeading
        title="Cài đặt & dữ liệu"
        description="Dữ liệu thuộc về bạn. Giữ một bản sao ở nơi an toàn."
      />
      <AuthPanel />
      <SyncPanel />
      <div className="settings-links">
        {links.map((l) => (
          <Link to={l.to} key={l.to} className="panel">
            <l.icon size={22} />
            <strong>{l.name}</strong>
            <ChevronRight size={18} />
          </Link>
        ))}
      </div>
      <ErrorNotice message={error} />
      <div className="two-columns">
        <section className="panel">
          <div className="section-heading">
            <h2>
              <Database size={20} />
              Sao lưu & khôi phục
            </h2>
          </div>
          <p className="muted">
            Backup JSON chứa toàn bộ dữ liệu, kể cả bản ghi đã xóa mềm. File chưa được mã hóa; hãy
            cất ở nơi riêng tư.
          </p>
          {db.cloud && (
            <p className="warning">
              Hồ sơ cloud không cho phép thay toàn bộ dữ liệu bằng backup. Đăng xuất để khôi phục
              vào sổ local riêng.
            </p>
          )}
          <div className="backup-info">
            <span>
              {data.transactions.length} giao dịch · {data.accounts.length} tài khoản
            </span>
            <small className="muted">
              {lastBackup
                ? `Lần xuất gần nhất: ${new Date(lastBackup).toLocaleString('vi-VN')}`
                : 'Bạn chưa xuất backup trên thiết bị này.'}
            </small>
          </div>
          <div className="settings-buttons">
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const exported = await backupService.export();
                  downloadBackup(exported, today());
                  await finance.setSetting('lastBackup', new Date().toISOString());
                  notify('Đã tạo file backup. Kiểm tra thư mục tải xuống.');
                })
              }
            >
              <Download size={18} />
              Xuất backup JSON
            </button>
            <button
              className="button secondary"
              disabled={busy || db.cloud}
              onClick={() => fileInput.current?.click()}
            >
              <Upload size={18} />
              Nhập backup
            </button>
            <input
              ref={fileInput}
              className="sr-only"
              aria-label="Chọn file backup"
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file)
                  void run(async () => {
                    setBackup(await readBackup(file));
                    setConfirmed(false);
                  });
              }}
            />
          </div>
          <p className="warning">
            Xóa dữ liệu trình duyệt, dùng chế độ riêng tư hoặc đổi địa chỉ web có thể làm mất dữ
            liệu. Sao lưu thường xuyên.
          </p>
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>
              <ShieldCheck size={20} />
              Lưu trữ trên thiết bị
            </h2>
          </div>
          <p className="status-label">{storage}</p>
          <p className="muted">
            Trình duyệt có quyền quyết định cấp lưu trữ bền vững. App vẫn hoạt động nếu yêu cầu
            không được cấp; backup luôn cần thiết.
          </p>
          <button
            className="button secondary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const granted = await requestPersistence();
                await refreshStorage();
                notify(
                  granted
                    ? 'Đã cấp lưu trữ bền vững.'
                    : 'Trình duyệt chưa cấp. Bạn vẫn có thể dùng app và sao lưu.',
                );
              })
            }
          >
            Yêu cầu lưu trữ bền vững
          </button>
          <div className="divider" />
          <p className="status-label">
            {offlineReady ? 'Đã lưu ứng dụng để dùng offline' : 'Đang kiểm tra bộ nhớ offline'}
          </p>
          <p className="muted">
            Sau lần tải đầy đủ qua HTTPS, bạn có thể mở lại app không cần mạng. Dữ liệu offline nằm
            trong trình duyệt hiện tại. Khi bật cloud, mở app hoặc bấm Đồng bộ ngay để cập nhật giữa
            các thiết bị.
          </p>
        </section>
      </div>
      <section className="panel install-panel">
        <span className="account-icon">
          <Smartphone size={26} />
        </span>
        <div>
          <h2>Cài Sổ tiền lên màn hình chính</h2>
          <p className="muted">Mở nhanh như một ứng dụng, không cần App Store.</p>
          {installed ? (
            <p className="income">App đang chạy ở chế độ độc lập.</p>
          ) : (
            <>
              <p>
                <strong>iPhone:</strong> mở bằng Safari → Chia sẻ → Thêm vào Màn hình chính.
              </p>
              <p>
                <strong>Android / desktop:</strong> chọn Cài đặt ứng dụng trong menu trình duyệt.
              </p>
            </>
          )}
          {installPrompt && (
            <button
              className="button primary"
              onClick={() =>
                void run(async () => {
                  await installPrompt.prompt();
                  await installPrompt.userChoice;
                  setInstallPrompt(undefined);
                })
              }
            >
              Cài ứng dụng
            </button>
          )}
        </div>
      </section>
      <p className="version-note muted">
        Sổ tiền · V2 · VND / vi-VN · Local-first, đồng bộ cloud tùy chọn.
      </p>
      {backup && (
        <Modal
          title="Khôi phục backup"
          onClose={() => {
            if (!busy) setBackup(undefined);
          }}
        >
          <div className="editor-form">
            <p>Backup ngày {new Date(backup.exportedAt).toLocaleString('vi-VN')} chứa:</p>
            <ul className="backup-counts">
              {Object.entries(backup.data).map(([key, values]) => (
                <li key={key}>
                  {
                    {
                      accounts: 'Tài khoản',
                      transactions: 'Giao dịch',
                      categories: 'Danh mục',
                      budgets: 'Ngân sách',
                      savingsGoals: 'Mục tiêu',
                      settings: 'Cài đặt',
                    }[key as keyof Backup['data']]
                  }
                  <strong>{values.length}</strong>
                </li>
              ))}
            </ul>
            <p className="warning">
              Thay thế toàn bộ dữ liệu trên thiết bị này. Không gộp dữ liệu. Hãy xuất backup hiện
              tại trước khi tiếp tục.
            </p>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Tôi hiểu dữ liệu hiện tại sẽ được thay thế.
            </label>
            <ErrorNotice message={error} />
            <div className="form-footer">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => setBackup(undefined)}
              >
                Hủy
              </button>
              <button
                className="button danger-solid"
                disabled={!confirmed || busy}
                onClick={() =>
                  void run(async () => {
                    await backupService.replace(backup);
                    setBackup(undefined);
                    await refreshStorage();
                    notify('Đã khôi phục backup trên thiết bị.');
                  })
                }
              >
                {busy ? 'Đang khôi phục…' : 'Thay thế dữ liệu'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
