import { useLiveQuery } from 'dexie-react-hooks';
import { useLocalData } from '../db/context/LocalDataProvider';
import { type FinanceData } from '../types/models';
export function useFinance(): { data?: FinanceData; error?: string } {
  const { finance } = useLocalData();
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
    [finance],
    {},
  );
}
