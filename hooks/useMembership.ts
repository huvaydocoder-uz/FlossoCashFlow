import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { accessState, type AccessState, type Membership } from '@/lib/membership';
import { queryKeys } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';
import type { MemberRole, MemberStatus } from '@/types/database';

// Joriy foydalanuvchining a'zoligi (biznes nomi va qo'shilish kodi bilan) yoki null.
export function useMembership() {
  const userId = useAuthStore((state) => state.session?.user.id);

  return useQuery({
    queryKey: queryKeys.membership(userId ?? ''),
    enabled: userId !== undefined,
    queryFn: async (): Promise<Membership | null> => {
      if (userId === undefined) {
        return null;
      }
      const { data, error } = await supabase
        .from('business_members')
        .select('role, status, business:businesses(id, name, join_code)')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      if (data === null || data.business === null) {
        return null;
      }
      return { role: data.role, status: data.status, business: data.business };
    },
  });
}

export type TeamMember = {
  userId: string;
  fullName: string | null;
  role: MemberRole;
  status: MemberStatus;
};

// Egasi uchun: jamoa a'zolari (kutilayotganlar birinchi).
export function useTeamMembers(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.team,
    enabled,
    queryFn: async (): Promise<TeamMember[]> => {
      const { data, error } = await supabase
        .from('business_members')
        .select('user_id, role, status, created_at, user:users(full_name)')
        .order('created_at', { ascending: true });
      if (error) {
        throw error;
      }
      return data
        .map((row) => ({
          userId: row.user_id,
          fullName: row.user?.full_name ?? null,
          role: row.role,
          status: row.status,
        }))
        .sort((a, b) => Number(a.status === 'active') - Number(b.status === 'active'));
    },
  });
}

function useInvalidateMembership() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['membership'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.team }),
    ]);
}

export function useCreateBusiness() {
  const invalidate = useInvalidateMembership();
  return useMutation({
    mutationFn: async (name: string): Promise<void> => {
      const { error } = await supabase.rpc('create_business', { p_name: name.trim() });
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useJoinBusiness() {
  const invalidate = useInvalidateMembership();
  return useMutation({
    mutationFn: async (code: string): Promise<void> => {
      const { error } = await supabase.rpc('join_business', { p_code: code.trim() });
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

// Sotuvchi biznesdan chiqadi yoki kutilayotgan so'rovini bekor qiladi.
export function useLeaveBusiness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { error } = await supabase.rpc('leave_business');
      if (error) {
        throw error;
      }
    },
    // Boshqa biznes ma'lumotlari keshda qolmasin.
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

export function useApproveMember() {
  const invalidate = useInvalidateMembership();
  return useMutation({
    mutationFn: async (userId: string): Promise<void> => {
      const { error } = await supabase.rpc('approve_member', { p_user_id: userId });
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

export function useRemoveMember() {
  const invalidate = useInvalidateMembership();
  return useMutation({
    mutationFn: async (userId: string): Promise<void> => {
      const { error } = await supabase.rpc('remove_member', { p_user_id: userId });
      if (error) {
        throw error;
      }
    },
    onSuccess: invalidate,
  });
}

// Ilovaga kirish holati (owner / seller / none / pending / loading / error).
export function useAccess(): AccessState {
  return accessState(useMembership());
}
