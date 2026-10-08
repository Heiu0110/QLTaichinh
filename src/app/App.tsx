import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import {
  LayoutDashboard,
  ArrowRightLeft,
  Wallet,
  Tags,
  ChartNoAxesCombined,
  Flag,
  Settings as SettingsIcon,
  Plus,
  PieChart,
  ShieldCheck,
  WifiOff,
  Check,
  LoaderCircle,
} from 'lucide-react';
import { useFinance } from '../hooks/useFinance';
import { AppContext, type Editor } from './context';
const Dashboard = lazy(() =>
  import('../pages/Dashboard').then((module) => ({ default: module.Dashboard })),
);
const Transactions = lazy(() =>
  import('../pages/Transactions').then((module) => ({ default: module.Transactions })),
);
const Accounts = lazy(() =>
  import('../pages/Accounts').then((module) => ({ default: module.Accounts })),
);
const Categories = lazy(() =>
  import('../pages/Categories').then((module) => ({ default: module.Categories })),
);
const Budgets = lazy(() =>
  import('../pages/Budgets').then((module) => ({ default: module.Budgets })),
);
const Savings = lazy(() =>
  import('../pages/Savings').then((module) => ({ default: module.Savings })),
);
const Reports = lazy(() =>
  import('../pages/Reports').then((module) => ({ default: module.Reports })),
);
const Settings = lazy(() =>
  import('../pages/Settings').then((module) => ({ default: module.Settings })),
);
import { Editors } from '../components/Editors';
import { ErrorNotice } from '../components/ui';
const navigation = [
  { to: '/', title: 'Tổng quan', icon: LayoutDashboard },
  { to: '/transactions', title: 'Giao dịch', icon: ArrowRightLeft },
  { to: '/accounts', title: 'Tài khoản', icon: Wallet },
  { to: '/categories', title: 'Danh mục', icon: Tags },
  { to: '/budgets', title: 'Ngân sách', icon: PieChart },
  { to: '/savings', title: 'Mục tiêu', icon: Flag },
  { to: '/reports', title: 'Báo cáo', icon: ChartNoAxesCombined },
  { to: '/settings', title: 'Cài đặt', icon: SettingsIcon },
];
class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="startup-state">
        <ErrorNotice message="Không thể hiển thị ứng dụng. Dữ liệu trên thiết bị được giữ nguyên. Hãy thử tải lại; không xóa dữ liệu trình duyệt." />
        <button className="button primary" onClick={() => window.location.reload()}>
          Thử tải lại
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export function App() {
  return (
    <ErrorBoundary>
      <FinanceApp />
    </ErrorBoundary>
  );
}
function FinanceApp() {
  const { data, error } = useFinance();
  const [editor, setEditor] = useState<Editor>();
  const [message, setMessage] = useState('');
  const [online, setOnline] = useState(navigator.onLine);
  const location = useLocation();
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW: (_url, registration) => {
      if (registration?.active) setOfflineReady(true);
    },
    onRegisterError: () =>
      setMessage('Chưa lưu được app offline. Hãy kiểm tra kết nối và tải lại.'),
  });
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 7000);
    return () => clearTimeout(timer);
  }, [message]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  if (error)
    return (
      <main className="startup-state">
        <h1>Không mở được dữ liệu</h1>
        <ErrorNotice message={error} />
        <p>
          Cho phép lưu trữ trong trình duyệt và tránh chế độ riêng tư. Không xóa dữ liệu nếu chưa có
          backup.
        </p>
        <button className="button primary" onClick={() => window.location.reload()}>
          Thử lại
        </button>
      </main>
    );
  if (!data)
    return (
      <main className="startup-state">
        <LoaderCircle className="spin" />
        <p>Đang mở sổ tiền của bạn…</p>
      </main>
    );
  return (
    <AppContext.Provider value={{ data, openEditor: setEditor, notify: setMessage }}>
      <div className="app-shell">
        <aside className="sidebar">
          <Link to="/" className="brand">
            <span className="brand-icon">
              <Wallet size={25} />
            </span>
            <span>
              Sổ tiền<small>CHI TIÊU CÓ CHỦ ĐÍCH</small>
            </span>
          </Link>
          <p className="nav-caption">KHÔNG GIAN CỦA BẠN</p>
          <nav aria-label="Điều hướng chính">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              >
                <item.icon size={20} />
                {item.title}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <ShieldCheck size={19} />
            <span>
              Dữ liệu riêng tư<small>Lưu trên thiết bị của bạn</small>
            </span>
            <span className="version-tag">V1</span>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <Link to="/" className="mobile-brand">
              <Wallet size={23} />
              Sổ tiền
            </Link>
            <div className="breadcrumb">
              Sổ tiền <span>/</span>{' '}
              {navigation.find((n) => n.to === location.pathname)?.title ?? 'Trang không tồn tại'}
            </div>
            <div className={`connection ${online ? '' : 'offline'}`}>
              {online ? <span className="status-dot" /> : <WifiOff size={15} />}
              <span>{online ? 'Lưu trên thiết bị' : 'Đang dùng offline'}</span>
            </div>
            <span className="avatar" aria-hidden="true">
              ST
            </span>
          </header>
          <main className="main-content" id="main-content">
            <Suspense
              fallback={
                <section className="panel">
                  <LoaderCircle className="spin" aria-label="Đang tải trang" />
                </section>
              }
            >
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/categories" element={<Categories />} />
                <Route path="/budgets" element={<Budgets />} />
                <Route path="/savings" element={<Savings />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings offlineReady={offlineReady} />} />
                <Route
                  path="*"
                  element={
                    <section className="panel">
                      <h1>Không tìm thấy trang</h1>
                      <Link to="/">Trở về tổng quan</Link>
                    </section>
                  }
                />
              </Routes>
            </Suspense>
            <footer className="page-footer">
              Một chút rõ ràng, mỗi ngày.<span>Sổ tiền · Local-first</span>
            </footer>
          </main>
        </div>
        <nav className="bottom-nav" aria-label="Điều hướng điện thoại">
          <NavLink to="/" end>
            <LayoutDashboard size={21} />
            <span>Tổng quan</span>
          </NavLink>
          <NavLink to="/transactions">
            <ArrowRightLeft size={21} />
            <span>Giao dịch</span>
          </NavLink>
          <button
            className="bottom-add"
            aria-label="Thêm giao dịch nhanh"
            onClick={() => setEditor({ kind: 'transaction' })}
          >
            <Plus size={27} />
            <span>Thêm</span>
          </button>
          <NavLink to="/budgets">
            <PieChart size={21} />
            <span>Ngân sách</span>
          </NavLink>
          <NavLink to="/settings">
            <SettingsIcon size={21} />
            <span>Thêm nữa</span>
          </NavLink>
        </nav>
      </div>
      {editor && <Editors editor={editor} onClose={() => setEditor(undefined)} />}
      <div className="toast-area">
        {message && (
          <div className="toast" role="status">
            <Check size={18} />
            <span>{message}</span>
            <button aria-label="Ẩn thông báo" onClick={() => setMessage('')}>
              ×
            </button>
          </div>
        )}
        {needRefresh && (
          <div className="update-toast" role="status">
            <span>Có phiên bản mới. Dữ liệu đã lưu sẽ được giữ lại.</span>
            <button
              className="button primary"
              disabled={!!editor}
              onClick={() => void updateServiceWorker(true)}
            >
              Cập nhật
            </button>
          </div>
        )}
      </div>
    </AppContext.Provider>
  );
}
