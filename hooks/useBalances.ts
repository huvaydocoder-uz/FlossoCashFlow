import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { CurrencyBalances, CurrencySummary } from '@/types/models';
import type { BalanceSummary } from '@/types/models';

function emptySummary(): CurrencySummary {
  return { balance: 0, income: 0, expense: 0 };
}

function emptyCurrency(): CurrencyBalances {
  return { total: emptySummary(), cash: emptySummary(), card: emptySummary() };
}

// "balances" view'idan: har bir valyuta bo'yicha naqd, karta va jami balans.
export function useBalances() {
  return useQuery({
    queryKey: queryKeys.balances,
    queryFn: async (): Promise<BalanceSummary> => {
      const { data, error } = await supabase
        .from('balances')
        .select('currency, payment_method, balance, total_income, total_expense');
      if (error) {
        throw error;
      }
      const summary: BalanceSummary = { UZS: emptyCurrency(), USD: emptyCurrency() };
      for (const row of data) {
        if (row.currency === null) {
          continue;
        }
        const values = {
          balance: Number(row.balance ?? 0),
          income: Number(row.total_income ?? 0),
          expense: Number(row.total_expense ?? 0),
        };
        const target = summary[row.currency];
        const method = row.payment_method ?? 'cash';
        target[method] = {
          balance: target[method].balance + values.balance,
          income: target[method].income + values.income,
          expense: target[method].expense + values.expense,
        };
        target.total = {
          balance: target.total.balance + values.balance,
          income: target.total.income + values.income,
          expense: target.total.expense + values.expense,
        };
      }
      return summary;
    },
  });
}
