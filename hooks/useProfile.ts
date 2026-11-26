import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import type { UserProfile } from '@/types/database';

type ProfileData = Pick<UserProfile, 'id' | 'full_name'>;

// public.users dan joriy foydalanuvchi profilini o'qiydi (RLS: faqat o'z qatori).
export function useProfile() {
  const userId = useAuthStore((state) => state.session?.user.id);

  return useQuery({
    queryKey: queryKeys.profile(userId ?? ''),
    enabled: userId !== undefined,
    queryFn: async (): Promise<ProfileData | null> => {
      if (userId === undefined) {
        return null;
      }
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data;
    },
  });
}

export function useUpdateProfileName() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user.id);

  return useMutation({
    mutationFn: async (fullName: string): Promise<void> => {
      if (userId === undefined) {
        return;
      }
      const { error } = await supabase
        .from('users')
        .update({ full_name: fullName.trim() })
        .eq('id', userId);
      if (error) {
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId ?? '') }),
  });
}
