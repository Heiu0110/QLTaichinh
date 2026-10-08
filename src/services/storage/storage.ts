export async function storageStatus(): Promise<'persistent' | 'temporary' | 'unsupported'> {
  if (!navigator.storage?.persisted) return 'unsupported';
  try {
    return (await navigator.storage.persisted()) ? 'persistent' : 'temporary';
  } catch {
    return 'unsupported';
  }
}
export async function requestPersistence() {
  if (!navigator.storage?.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}
