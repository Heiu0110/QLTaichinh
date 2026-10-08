import { describe, expect, it } from 'vitest';
import { readCloudConfig } from '../src/auth/config';
describe('frontend auth configuration', () => {
  it('allows local-only mode without cloud configuration', () =>
    expect(readCloudConfig()).toBeNull());
  it('rejects incomplete config and privileged keys', () => {
    expect(() => readCloudConfig('https://example.supabase.co')).toThrow();
    expect(() => readCloudConfig('https://example.supabase.co', 'sb_secret_private')).toThrow();
    const key = `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`;
    expect(() => readCloudConfig('https://example.supabase.co', key)).toThrow();
  });
  it('restricts the endpoint to an exact HTTPS origin', () => {
    expect(() => readCloudConfig('http://example.supabase.co', 'sb_publishable_test')).toThrow();
    expect(() =>
      readCloudConfig('https://example.supabase.co/path', 'sb_publishable_test'),
    ).toThrow();
    expect(readCloudConfig('https://example.supabase.co', 'sb_publishable_test')?.url).toBe(
      'https://example.supabase.co',
    );
  });
});
