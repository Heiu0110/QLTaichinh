import { createContext, useContext } from 'react';
import {
  type Account,
  type Budget,
  type Category,
  type FinanceData,
  type SavingsGoal,
  type Transaction,
} from '../types/models';
export type Editor =
  | { kind: 'transaction'; value?: Transaction }
  | { kind: 'account'; value?: Account }
  | { kind: 'category'; value?: Category }
  | { kind: 'budget'; value?: Budget }
  | { kind: 'goal'; value?: SavingsGoal };
export interface AppState {
  data: FinanceData;
  openEditor: (editor: Editor) => void;
  notify: (message: string) => void;
}
export const AppContext = createContext<AppState | null>(null);
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('App context missing');
  return ctx;
}
