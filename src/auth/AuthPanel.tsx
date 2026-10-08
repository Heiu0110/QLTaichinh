import { useState } from 'react';
import { authService } from './authService';
import { useAuth } from './AuthProvider';
import { ErrorNotice, Field } from '../components/ui';
import { errorMessage } from '../utils/format';
export function AuthPanel() {
  const auth = useAuth();
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  return (
    <section className="panel auth-panel">
      <h2>Tài khoản cloud</h2>
      {!authService.configured ? (
        <p className="muted">
          Chưa cấu hình Supabase. Bạn vẫn dùng đầy đủ chế độ lưu trên thiết bị.
        </p>
      ) : (
        <>
          <p className="muted">
            {auth.user
              ? `Đã đăng nhập: ${auth.user.email}`
              : 'Đăng nhập để kết nối dữ liệu giữa các thiết bị. Chế độ local không cần đăng nhập.'}
          </p>
          <ErrorNotice message={error || auth.error || ''} />
          {message && <p role="status">{message}</p>}
          {(!auth.user || auth.recovery) && (
            <form
              className="auth-form"
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy) return;
                setBusy(true);
                setError('');
                setMessage('');
                try {
                  if (auth.recovery) {
                    await authService.changePassword(password);
                    setMessage('Đã đổi mật khẩu.');
                  } else if (mode === 'login') await authService.signIn(email, password);
                  else if (mode === 'signup') {
                    const signedIn = await authService.signUp(email, password);
                    setMessage(
                      signedIn
                        ? 'Đã tạo tài khoản.'
                        : 'Kiểm tra email để xác nhận tài khoản, sau đó đăng nhập.',
                    );
                  } else {
                    await authService.requestReset(email);
                    setMessage('Nếu email hợp lệ, hãy kiểm tra thư để đặt lại mật khẩu.');
                  }
                  setPassword('');
                } catch (error) {
                  setError(errorMessage(error));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {!auth.recovery && (
                <Field label="Email">
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
              )}
              {(mode !== 'reset' || auth.recovery) && (
                <Field label={auth.recovery ? 'Mật khẩu mới' : 'Mật khẩu'}>
                  <input
                    type="password"
                    minLength={8}
                    maxLength={128}
                    autoComplete={
                      mode === 'login' && !auth.recovery ? 'current-password' : 'new-password'
                    }
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              )}
              <button className="button primary" disabled={busy || auth.loading}>
                {busy
                  ? 'Đang xử lý…'
                  : auth.recovery
                    ? 'Lưu mật khẩu mới'
                    : mode === 'login'
                      ? 'Đăng nhập'
                      : mode === 'signup'
                        ? 'Đăng ký'
                        : 'Gửi email khôi phục'}
              </button>
              {!auth.recovery && (
                <div className="settings-buttons">
                  {(['login', 'signup', 'reset'] as const)
                    .filter((m) => m !== mode)
                    .map((m) => (
                      <button
                        className="button secondary"
                        type="button"
                        key={m}
                        onClick={() => {
                          setMode(m);
                          setError('');
                          setMessage('');
                        }}
                      >
                        {m === 'login'
                          ? 'Đăng nhập'
                          : m === 'signup'
                            ? 'Tạo tài khoản'
                            : 'Quên mật khẩu'}
                      </button>
                    ))}
                </div>
              )}
            </form>
          )}
          {(auth.user || auth.profileUser) && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void authService
                  .signOut()
                  .catch(() => setMessage('Đã đóng phiên trên thiết bị.'))
                  .finally(() => setBusy(false));
              }}
            >
              Đăng xuất trên thiết bị
            </button>
          )}
        </>
      )}
    </section>
  );
}
