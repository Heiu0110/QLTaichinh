import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '../../auth/AuthProvider';
import { cloudConfig, supabase } from '../../auth/client';
import { FinanceDatabase, userDatabaseName } from '../database';
import { FinanceService } from '../../services/finance';
import { BackupService } from '../../services/backup/backup';
import { guestDatabaseName, reserveLegacy } from './profiles';
import { SupabaseRemoteSyncRepository } from '../../sync/remote/SupabaseRemoteSyncRepository';
import { SyncEngine } from '../../sync/SyncEngine';
import { SyncCoordinator } from '../../sync/SyncCoordinator';
import { BootstrapService } from '../../sync/BootstrapService';
interface LocalContext {
  id: string;
  db: FinanceDatabase;
  finance: FinanceService;
  backupService: BackupService;
  engine?: SyncEngine;
  coordinator?: SyncCoordinator;
  bootstrap?: BootstrapService;
}
const Context = createContext<LocalContext | null>(null);
export function useLocalData() {
  const value = useContext(Context);
  if (!value) throw new Error('Local data context missing');
  return value;
}
export function LocalDataProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const [context, setContext] = useState<LocalContext>();
  const [error, setError] = useState('');
  const [guestEpoch, setGuestEpoch] = useState(0);
  const owner = auth.profileUser?.id;
  const identity = owner ?? `guest:${guestEpoch}`;
  useEffect(() => {
    const change = (e: StorageEvent) => {
      if (e.key === 'sotien-guest-database') setGuestEpoch((n) => n + 1);
    };
    window.addEventListener('storage', change);
    return () => window.removeEventListener('storage', change);
  }, []);
  useEffect(() => {
    if (auth.loading) return;
    let cancelled = false;
    let db: FinanceDatabase | undefined;
    let coordinator: SyncCoordinator | undefined;
    let bootstrap: BootstrapService | undefined;
    setError('');
    void (async () => {
      const name =
        owner && cloudConfig
          ? userDatabaseName(cloudConfig.projectScope, owner)
          : await guestDatabaseName();
      if (cancelled) return;
      db = new FinanceDatabase(name, { cloud: !!owner });
      await db.open();
      if (owner) {
        await reserveLegacy(db);
      }
      if (cancelled) {
        db.retire();
        return;
      }
      const engine =
        owner && supabase
          ? new SyncEngine(db, new SupabaseRemoteSyncRepository(supabase, owner))
          : undefined;
      coordinator = engine ? new SyncCoordinator(engine) : undefined;
      bootstrap = engine ? new BootstrapService(db, engine) : undefined;
      setContext({
        id: identity,
        db,
        finance: new FinanceService(db),
        backupService: new BackupService(db),
        engine,
        coordinator,
        bootstrap,
      });
    })().catch(() => {
      if (!cancelled)
        setError('Không mở được hồ sơ dữ liệu. Hãy tải lại; dữ liệu cũ được giữ nguyên.');
    });
    return () => {
      cancelled = true;
      coordinator?.stop();
      bootstrap?.dispose();
      db?.retire();
    };
  }, [identity, owner, auth.loading]);
  useEffect(() => {
    if (context?.id !== identity) return;
    context.coordinator?.start(auth.user?.id === owner && !!owner);
    return () => context.coordinator?.stop();
  }, [context, identity, owner, auth.user]);
  if (auth.loading || context?.id !== identity)
    return (
      <main className="startup-state">
        <p role={error ? 'alert' : 'status'}>{error || 'Đang mở hồ sơ dữ liệu…'}</p>
      </main>
    );
  return (
    <Context.Provider value={context}>
      <div key={identity}>{children}</div>
    </Context.Provider>
  );
}
