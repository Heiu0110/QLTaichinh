import { expect, test, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseRemoteSyncRepository } from '../src/sync/remote/SupabaseRemoteSyncRepository';
function fake(response: unknown, user = 'A') {
  const headers = new Map<string, string>();
  const query = {
    setHeader: vi.fn((key: string, value: string) => {
      headers.set(key, value);
      return query;
    }),
    abortSignal: vi.fn(async () => ({ data: response, error: null, status: 200 })),
  };
  const rpc = vi.fn(() => query);
  const sdk = {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: user }, access_token: 'session-A-token' } },
        error: null,
      })),
    },
    rpc,
  } as unknown as SupabaseClient;
  return { sdk, rpc, headers };
}
test('RPC binds Authorization to the same-user session snapshot, preventing account-switch token races', async () => {
  const { sdk, headers } = fake({ initialized: true, upperBound: '0', cursor: '0', changes: [] });
  await new SupabaseRemoteSyncRepository(sdk, 'A').pullChanges('0');
  expect(headers.get('Authorization')).toBe('Bearer session-A-token');
});
test('a mismatched authenticated user cannot make an RPC from another profile', async () => {
  const { sdk, rpc } = fake({}, 'B');
  await expect(new SupabaseRemoteSyncRepository(sdk, 'A').pullChanges('0')).rejects.toMatchObject({
    kind: 'auth',
  });
  expect(rpc).not.toHaveBeenCalled();
});
test('invalid or skipped remote pages cannot advance the local cursor', async () => {
  for (const response of [
    { initialized: true, upperBound: '4', cursor: '4', changes: [] },
    { initialized: true, upperBound: '4', cursor: '0', changes: [] },
  ]) {
    const { sdk } = fake(response);
    await expect(new SupabaseRemoteSyncRepository(sdk, 'A').pullChanges('0')).rejects.toThrow();
  }
});
