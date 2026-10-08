import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { authService, type AuthState } from './authService';
const Context = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const state = useSyncExternalStore(authService.subscribe, authService.getSnapshot);
  useEffect(() => {
    void authService.start();
  }, []);
  return <Context.Provider value={state}>{children}</Context.Provider>;
}
export function useAuth() {
  const state = useContext(Context);
  if (!state) throw new Error('Auth provider missing');
  return state;
}
