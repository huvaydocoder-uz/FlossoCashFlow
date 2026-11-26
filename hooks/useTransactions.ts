import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { periodStart } from '@/lib/dates';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { TransactionFilters, TransactionListItem } from '@/types/models';

export const PAGE_SIZE = 30;

const LIST_SELECT =
  'id, type, amount, currency, payment_method, note, occurred_at, created_at, category_id, source, debt_id, category:categories(id, name)';

// LIKE qidiruvidagi maxsus belgilarni oddiy belgi qilib yuboramiz.
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function baseListQuery() {
  return supabase.from('transactions').select(LIST_SELECT);
}

export function useRecentTransactions(limit: number) {
  return useQuery({
    queryKey: queryKeys.transactions.recent(limit),
    queryFn: async (): Promise<TransactionListItem[]> => {
      const { data, error } = await baseListQuery()
        .order('occurred_at', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

// Tarix: filtrlar bilan, sahifalab (har safar PAGE_SIZE ta) yuklanadi.
export function useTransactionList(filters: TransactionFilters) {
  return useInfiniteQuery({
    queryKey: queryKeys.transactions.list(filters),
    // Filtr o'zgarganda yangi natija kelguncha eskisi ko'rinib turadi (ekran "sakramaydi").
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    getNextPageParam: (lastPage: TransactionListItem[], allPages: TransactionListItem[][]) =>
      lastPage.length < PAGE_SIZE ? undefined : allPages.length,
    queryFn: async ({ pageParam }): Promise<TransactionListItem[]> => {
      let query = baseListQuery();
      if (filters.type !== 'all') {
        query = query.eq('type', filters.type);
      }
      if (filters.currency !== 'all') {
        query = query.eq('currency', filters.currency);
      }
      if (filters.paymentMethod !== 'all') {
        query = query.eq('payment_method', filters.paymentMethod);
      }
      if (filters.categoryId !== 'all') {
        query = query.eq('category_id', filters.categoryId);
      }
      const from = periodStart(filters.period);
      if (from !== null) {
        query = query.gte('occurred_at', from);
      }
      const search = filters.search.trim();
      if (search.length > 0) {
        query = query.ilike('note', `%${escapeLike(search)}%`);
      }
      const start = pageParam * PAGE_SIZE;
      const { data, error } = await query
        .order('occurred_at', { ascending: false })
        .order('created_at', { ascending: false })
        .range(start, start + PAGE_SIZE - 1);
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: queryKeys.transactions.detail(id),
    queryFn: async (): Promise<TransactionListItem | null> => {
      const { data, error } = await baseListQuery().eq('id', id).maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
  });
}
