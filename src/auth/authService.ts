import type { AuthChangeEvent, Session, SupabaseClient } from '@supabase/supabase-js';
import { cloudConfig, supabase } from './client';
export interface AuthUser {
  id: string;
  email: string;
}
export interface AuthState {
  profileUser: AuthUser | null;
  user: AuthUser | null;
  loading: boolean;
  recovery: boolean;
  error?: string;
  explicitLogout: boolean;
}
const userFromSession = (session: Session | null): AuthUser | null =>
  session ? { id: session.user.id, email: session.user.email ?? '' } : null;
export class AuthService {
  private listeners = new Set<() => void>();
  private state: AuthState = {
    profileUser: null,
    user: null,
    loading: true,
    recovery: false,
    explicitLogout: false,
  };
  private epoch = 0;
  private unsubscribe?: () => void;
  constructor(
    private client: SupabaseClient | null,
    private storageKey?: string,
  ) {
    if (client && storageKey && typeof localStorage !== 'undefined') {
      try {
        const saved = JSON.parse(
          localStorage.getItem(`${storageKey}-profile`) ?? 'null',
        ) as AuthUser | null;
        if (saved && /^[0-9a-f-]{36}$/i.test(saved.id) && typeof saved.email === 'string') {
          this.state.profileUser = saved;
          this.state.loading = false;
        }
      } catch {
        /* Missing local preference must not prevent local mode. */
      }
      if (typeof window !== 'undefined')
        window.addEventListener('storage', (event) => {
          if (event.key === `${storageKey}-logout` && event.newValue) {
            this.epoch++;
            this.publish({
              user: null,
              profileUser: null,
              explicitLogout: true,
              loading: false,
              recovery: false,
            });
            void this.client?.auth.signOut({ scope: 'local' }).catch(() => undefined);
          }
        });
    }
  }
  get configured() {
    return !!this.client;
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(state: Partial<AuthState>) {
    if (state.user) {
      state.profileUser = state.user;
      if (this.storageKey && typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem(`${this.storageKey}-profile`, JSON.stringify(state.user));
        } catch {
          /* Auth session still uses SDK storage; this is an optional offline profile hint. */
        }
      }
    }
    this.state = { ...this.state, ...state };
    this.listeners.forEach((listener) => listener());
  }
  async start() {
    if (!this.client) {
      this.publish({ loading: false });
      return;
    }
    if (this.unsubscribe) return;
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      // Do not await another SDK auth call while its auth lock is held.
      const epoch = this.epoch;
      queueMicrotask(() => {
        if (epoch === this.epoch && !this.state.explicitLogout) this.accept(event, session);
      });
    });
    this.unsubscribe = () => data.subscription.unsubscribe();
    const epoch = this.epoch;
    try {
      const { data, error } = await this.client.auth.getSession();
      if (epoch !== this.epoch) return;
      this.publish({
        user: userFromSession(data.session),
        loading: false,
        ...(error ? { error: 'Phiên cloud cần đăng nhập lại.' } : {}),
      });
    } catch {
      if (epoch === this.epoch)
        this.publish({
          loading: false,
          error: 'Không kiểm tra được phiên cloud. Dữ liệu local vẫn dùng được.',
        });
    }
  }
  private accept(event: AuthChangeEvent, session: Session | null) {
    this.publish({
      user: userFromSession(session),
      loading: false,
      recovery: event === 'PASSWORD_RECOVERY' || this.state.recovery,
      error: event === 'SIGNED_OUT' ? 'Đăng nhập lại để đồng bộ.' : undefined,
    });
    if (event === 'PASSWORD_RECOVERY' && typeof history !== 'undefined')
      history.replaceState(null, '', '/settings');
  }
  private requireClient() {
    if (!this.client)
      throw new Error('Môi trường chưa cấu hình Supabase. Chế độ local vẫn hoạt động.');
    return this.client;
  }
  async signIn(email: string, password: string) {
    const epoch = ++this.epoch;
    this.publish({ explicitLogout: false, error: undefined });
    const { data, error } = await this.requireClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (epoch !== this.epoch) return;
    if (error) throw new Error('Không đăng nhập được. Kiểm tra email/mật khẩu và kết nối.');
    this.publish({ user: userFromSession(data.session), loading: false, recovery: false });
  }
  async signUp(email: string, password: string) {
    const epoch = ++this.epoch;
    this.publish({ explicitLogout: false });
    const { data, error } = await this.requireClient().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${location.origin}/settings` },
    });
    if (epoch !== this.epoch) return false;
    if (error) throw new Error('Không đăng ký được. Kiểm tra thông tin hoặc thử lại sau.');
    if (data.session) this.publish({ user: userFromSession(data.session), loading: false });
    return !!data.session;
  }
  async requestReset(email: string) {
    const { error } = await this.requireClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${location.origin}/settings`,
    });
    if (error) throw new Error('Chưa gửi được email đặt lại mật khẩu. Hãy thử lại.');
  }
  async changePassword(password: string) {
    const { error } = await this.requireClient().auth.updateUser({ password });
    if (error) throw new Error('Chưa đổi được mật khẩu. Mở lại liên kết khôi phục hợp lệ.');
    this.publish({ recovery: false });
  }
  async signOut() {
    this.epoch++;
    if (this.storageKey) {
      try {
        localStorage.removeItem(`${this.storageKey}-profile`);
        localStorage.setItem(`${this.storageKey}-logout`, crypto.randomUUID());
      } catch {
        /* Always clear in-memory state, including when storage is unavailable. */
      }
    }
    this.publish({
      profileUser: null,
      user: null,
      loading: false,
      recovery: false,
      explicitLogout: true,
      error: undefined,
    });
    try {
      await this.client?.auth.signOut({ scope: 'local' });
    } finally {
      if (this.storageKey) {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(`${this.storageKey}-code-verifier`);
      }
    }
  }
}
export const authService = new AuthService(supabase, cloudConfig?.storageKey);
