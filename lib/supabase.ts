import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { ENV, ENV_ERROR } from '@/lib/env';
import type { Database } from '@/types/database';

// Sozlash xatosi bo'lsa, ilova kalitlarni ishlatmaydi va sozlash ekranini ko'rsatadi
// (app/_layout.tsx). Klient esa import paytida yiqilmasligi uchun soxta manzil bilan yaratiladi.
const PLACEHOLDER_URL = 'https://placeholder.invalid';
const PLACEHOLDER_KEY = 'placeholder';

export const supabase = createClient<Database>(
  ENV_ERROR === null ? ENV.supabaseUrl : PLACEHOLDER_URL,
  ENV_ERROR === null ? ENV.supabaseKey : PLACEHOLDER_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Ilova ekranda bo'lganda tokenni avtomatik yangilaydi, fonga o'tganda to'xtatadi.
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});
