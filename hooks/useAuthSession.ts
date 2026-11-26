import { useEffect } from 'react';

import { queryClient } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/auth';

// Saqlangan sessiyani o'qiydi (INITIAL_SESSION) va keyingi o'zgarishlarni kuzatadi:
// kirish, chiqish, token yangilanishi.
export function useAuthSession() {
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'SIGNED_OUT') {
        // Boshqa foydalanuvchi kirsa, eski ma'lumotlar keshda qolmasin.
        queryClient.clear();
      }
    });

    return () => subscription.unsubscribe();
  }, [setSession]);
}
