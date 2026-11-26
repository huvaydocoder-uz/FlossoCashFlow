import { useQuery } from '@tanstack/react-query';

import { addDays, startOfDay } from '@/lib/dates';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { CurrencyCode, PaymentMethod, TransactionType } from '@/types/database';

export type StatRow = {
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  payment_method: PaymentMethod;
  occurred_at: string;
  category: { name: string } | null;
};

const MAX_ROWS = 10000;

// Hisobot uchun: `since` dan keyingi amallar (faqat kerakli ustunlar).
export function useStats(since: Date) {
  const from = since.toISOString();
  return useQuery({
    queryKey: queryKeys.stats(from),
    queryFn: async (): Promise<StatRow[]> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('type, amount, currency, payment_method, occurred_at, category:categories(name)')
        .gte('occurred_at', from)
        .order('occurred_at', { ascending: true })
        .limit(MAX_ROWS);
      if (error) {
        throw error;
      }
      return data.map((row) => ({ ...row, amount: Number(row.amount) }));
    },
  });
}
