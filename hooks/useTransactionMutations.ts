import { useMutation, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { TransactionPayload } from '@/types/models';

type SaveInput = {
  // id bo'lsa — tahrirlash, bo'lmasa — yangi amal.
  id?: string;
  payload: TransactionPayload;
};

// Amal o'zgarsa, ro'yxatlar va balans fonda qayta yuklanadi — oyna esa darhol yopiladi.
function useInvalidateTransactions() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.balances });
    void queryClient.invalidateQueries({ queryKey: queryKeys.debts });
  };
}

export function useSaveTransaction() {
  const invalidate = useInvalidateTransactions();

  return useMutation({
    mutationFn: async ({ id, payload }: SaveInput): Promise<void> => {
      const { error } =
        id === undefined
          ? await supabase.from('transactions').insert(payload)
          : await supabase.from('transactions').update(payload).eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useDeleteTransaction() {
  const invalidate = useInvalidateTransactions();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}
