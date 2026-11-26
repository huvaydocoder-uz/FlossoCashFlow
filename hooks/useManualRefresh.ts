import { useCallback, useState } from 'react';

// Pastga tortib yangilash: aylana faqat foydalanuvchi o'zi tortganda ko'rinadi,
// fondagi avtomatik yangilanishlarda emas.
export function useManualRefresh(refetchers: ReadonlyArray<() => Promise<unknown>>) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void Promise.allSettled(refetchers.map((refetch) => refetch())).finally(() => setRefreshing(false));
  }, [refetchers]);

  return { refreshing, onRefresh };
}
