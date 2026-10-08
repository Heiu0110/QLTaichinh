export interface CloudConfig {
  url: string;
  key: string;
  projectScope: string;
  storageKey: string;
}
export function readCloudConfig(url?: string, key?: string): CloudConfig | null {
  if (!url && !key) return null;
  if (!url || !key) throw new Error('Cần cả URL và publishable key của Supabase.');
  const parsed = new URL(url);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== '/' && parsed.pathname !== '')
  )
    throw new Error('Supabase URL phải là HTTPS origin hợp lệ.');
  if (key.startsWith('sb_secret_'))
    throw new Error('Không được dùng secret/service_role key trong frontend.');
  if (!key.startsWith('sb_publishable_')) {
    try {
      const payload = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as {
        role?: string;
      };
      if (payload.role !== 'anon') throw new Error();
    } catch {
      throw new Error('Chỉ dùng publishable key hoặc legacy anon key.');
    }
  }
  const projectScope = encodeURIComponent(parsed.origin);
  return { url: parsed.origin, key, projectScope, storageKey: `sotien-auth-${projectScope}` };
}
