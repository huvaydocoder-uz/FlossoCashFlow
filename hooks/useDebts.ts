import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { syncDebtReminders } from '@/lib/debtReminders';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { CurrencyCode, PaymentMethod } from '@/types/database';
import type { DebtPayload, DebtWithPayments } from '@/types/models';

const DEBT_SELECT =
  'id, user_id, business_id, direction, counterparty, amount, currency, due_date, note, phone, sector, origin_method, origin_transaction_id, paid_at, transaction_id, created_at, updated_at, payments:debt_payments(id, amount, currency, rate_uzs_per_usd, payment_method, paid_at)';

// Barcha qarzlar muddati bo'yicha. Ro'yxat yangilansa, telefondagi eslatmalar ham yangilanadi.
export function useDebts() {
  const query = useQuery({
    queryKey: queryKeys.debts,
    queryFn: async (): Promise<DebtWithPayments[]> => {
      const { data, error } = await supabase
        .from('debts')
        .select(DEBT_SELECT)
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) {
        throw error;
      }
      return data.map((debt) => ({
        ...debt,
        amount: Number(debt.amount),
        payments: [...debt.payments]
          .map((payment) => ({
            ...payment,
            amount: Number(payment.amount),
            rate_uzs_per_usd: payment.rate_uzs_per_usd == null ? null : Number(payment.rate_uzs_per_usd),
          }))
          .sort((a, b) => a.paid_at.localeCompare(b.paid_at)),
      }));
    },
  });

  useEffect(() => {
    if (query.data !== undefined) {
      void syncDebtReminders(query.data);
    }
  }, [query.data]);

  return query;
}

export function useDebt(id: string) {
  const debts = useDebts();
  return { ...debts, data: debts.data === undefined ? undefined : (debts.data.find((d) => d.id === id) ?? null) };
}

function useInvalidateDebts() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.debts }),
      queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.balances }),
      queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
    ]);
}

export function useSaveDebt() {
  const invalidate = useInvalidateDebts();
  return useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: DebtPayload }): Promise<void> => {
      const { error } =
        id === undefined
          ? await supabase.from('debts').insert(payload)
          : await supabase.from('debts').update(payload).eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteDebt() {
  const invalidate = useInvalidateDebts();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('debts').delete().eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

type AddPaymentInput = {
  debtId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: Date;
  currency: CurrencyCode;
  // Qarz valyutasidan boshqa valyutada to'lansa — 1 $ = N so'm.
  rate: number | null;
};

// Qarzga to'lov: bazada to'lov va mos kirim/chiqim amali birga yoziladi.
export function useAddDebtPayment() {
  const invalidate = useInvalidateDebts();
  return useMutation({
    mutationFn: async ({ debtId, amount, method, paidAt, currency, rate }: AddPaymentInput): Promise<void> => {
      const { error } = await supabase.rpc('add_debt_payment', {
        p_debt_id: debtId,
        p_amount: amount,
        p_payment_method: method,
        p_paid_at: paidAt.toISOString(),
        p_currency: currency,
        p_rate: rate,
      });
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

// To'lovni o'chirish: kassa amali ham o'chadi, qarz qayta ochiladi.
export function useDeleteDebtPayment() {
  const invalidate = useInvalidateDebts();
  return useMutation({
    mutationFn: async (paymentId: string): Promise<void> => {
      const { error } = await supabase.rpc('delete_debt_payment', { p_payment_id: paymentId });
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}
