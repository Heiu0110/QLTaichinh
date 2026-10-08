import { expect, test, vi } from 'vitest';
import type { SupabaseClient, Session, AuthChangeEvent } from '@supabase/supabase-js';
import { AuthService } from '../src/auth/authService';
const user = { id: 'a28e4189-f6d6-4e36-98fd-65ff05622b53', email: 'fixture@example.invalid' };
const session = { user } as Session;
function client(initial: Session | null = session) {
  let listener: (event: AuthChangeEvent, session: Session | null) => void = () => {};
  const auth = {
    onAuthStateChange: vi.fn((fn) => {
      listener = fn;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    getSession: vi.fn(async () => ({ data: { session: initial }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: { session }, error: null })),
    signUp: vi.fn(async () => ({ data: { session: null }, error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    updateUser: vi.fn(async () => ({ error: null })),
    signOut: vi.fn(async () => ({ error: null })),
  };
  return {
    sdk: { auth } as unknown as SupabaseClient,
    auth,
    emit: async (event: AuthChangeEvent, value: Session | null) => {
      listener(event, value);
      await Promise.resolve();
    },
  };
}
test('restored session, expiration and explicit logout preserve the correct distinction', async () => {
  const mock = client();
  const service = new AuthService(mock.sdk);
  await service.start();
  expect(service.getSnapshot().profileUser?.id).toBe(user.id);
  await mock.emit('SIGNED_OUT', null);
  expect(service.getSnapshot().user).toBeNull();
  expect(service.getSnapshot().profileUser?.id).toBe(user.id);
  await service.signIn(user.email, 'password');
  expect(service.getSnapshot().user?.id).toBe(user.id);
  await service.signOut();
  expect(service.getSnapshot().profileUser).toBeNull();
  await mock.emit('TOKEN_REFRESHED', session);
  expect(service.getSnapshot().user).toBeNull();
});
test('late login result cannot undo explicit logout', async () => {
  const mock = client(null);
  let resolve!: (value: unknown) => void;
  mock.auth.signInWithPassword.mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r;
      }) as never,
  );
  const service = new AuthService(mock.sdk);
  await service.start();
  const pending = service.signIn(user.email, 'password');
  await service.signOut();
  resolve({ data: { session }, error: null });
  await pending;
  expect(service.getSnapshot().user).toBeNull();
});
test('password recovery flow, failed login and signup confirmation are explicit', async () => {
  vi.stubGlobal('location', { origin: 'https://app.example.invalid' });
  const mock = client(null);
  const service = new AuthService(mock.sdk);
  await service.start();
  expect(await service.signUp(user.email, 'password')).toBe(false);
  await service.requestReset(user.email);
  expect(mock.auth.resetPasswordForEmail).toHaveBeenCalledWith(user.email, {
    redirectTo: 'https://app.example.invalid/settings',
  });
  await mock.emit('PASSWORD_RECOVERY', session);
  expect(service.getSnapshot().recovery).toBe(true);
  await service.changePassword('new-password');
  expect(service.getSnapshot().recovery).toBe(false);
  mock.auth.signInWithPassword.mockResolvedValue({ data: { session: null }, error: {} } as never);
  await expect(service.signIn(user.email, 'wrong')).rejects.toThrow('Không đăng nhập');
  vi.unstubAllGlobals();
});
test('remembered offline profile opens immediately without waiting for a stalled auth refresh', () => {
  vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(user) });
  const mock = client(null);
  const service = new AuthService(mock.sdk, 'fixture');
  expect(service.getSnapshot()).toMatchObject({ loading: false, user: null, profileUser: user });
  vi.unstubAllGlobals();
});
