import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { Category, TransactionType } from '@/types/database';

// Joriy foydalanuvchining barcha kategoriyalari (RLS: faqat o'ziniki), nom bo'yicha.
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, user_id, business_id, name, type, created_at')
        .order('name', { ascending: true });
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

type CreateCategoryInput = {
  name: string;
  type: TransactionType;
};

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ name, type }: CreateCategoryInput): Promise<Category> => {
      const { data, error } = await supabase
        .from('categories')
        .insert({ name: name.trim(), type })
        .select('id, user_id, business_id, name, type, created_at')
        .single();
      if (error) {
        throw error;
      }
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) {
        throw error;
      }
    },
    // Tranzaksiyalardagi kategoriya nomi ham o'zgaradi («Kategoriyasiz»).
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.categories }),
        queryClient.invalidateQueries({ queryKey: queryKeys.transactions.all }),
      ]),
  });
}
