import { useLiveQuery } from 'dexie-react-hooks';
import { finance } from '../services/finance';
import { type FinanceData } from '../types/models';
export function useFinance(): { data?: FinanceData; error?: string } {
  return useLiveQuery(
    async () => {
      try {
        return { data: await finance.snapshot() };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Không mở được bộ nhớ trên thiết bị.',
        };
      }
    },
    [],
    {},
  );
}
