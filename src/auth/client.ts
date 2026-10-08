import { createClient } from '@supabase/supabase-js';
import { readCloudConfig } from './config';
export const cloudConfig = readCloudConfig(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const supabase = cloudConfig
  ? createClient(cloudConfig.url, cloudConfig.key, {
      auth: {
        storageKey: cloudConfig.storageKey,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
      global: {
        fetch: (input, init) =>
          fetch(input, {
            ...init,
            signal: init?.signal ?? AbortSignal.timeout(20_000),
            cache: 'no-store',
          }),
      },
    })
  : null;
