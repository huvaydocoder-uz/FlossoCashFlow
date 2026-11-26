import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

type AuthState = {
  session: Session | null;
  // Saqlangan sessiya telefondan o'qib bo'lingachgina true bo'ladi.
  isInitialized: boolean;
  setSession: (session: Session | null) => void;
};

// Sessiya manbai — Supabase (hooks/useAuthSession.ts). Bu store faqat uni ilovaga tarqatadi.
export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  isInitialized: false,
  setSession: (session) => set({ session, isInitialized: true }),
}));
