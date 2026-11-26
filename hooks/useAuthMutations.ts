import { useMutation } from '@tanstack/react-query';

import { TEXTS } from '@/constants/texts';
import { AuthMessageError } from '@/lib/authErrors';
import { supabase } from '@/lib/supabase';

type SignInInput = {
  email: string;
  password: string;
};

type SignUpInput = SignInInput & {
  fullName: string;
};

type SignUpResult = {
  // Supabase'da "Confirm email" yoqilgan bo'lsa, sessiya darhol berilmaydi.
  needsEmailConfirmation: boolean;
};

// Muvaffaqiyatli kirishdan so'ng sessiyani useAuthSession ushlaydi va
// navigatsiya o'zi asosiy ekranga o'tkazadi.
export function useSignIn() {
  return useMutation({
    mutationFn: async ({ email, password }: SignInInput): Promise<void> => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        throw error;
      }
    },
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: async ({ email, password, fullName }: SignUpInput): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        // full_name bazadagi trigger orqali public.users jadvaliga yoziladi.
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) {
        throw error;
      }
      // Email tasdiqlash yoqilganda, mavjud email uchun Supabase xato bermaydi,
      // faqat identities ro'yxati bo'sh keladi.
      if (data.user !== null && data.user.identities?.length === 0) {
        throw new AuthMessageError(TEXTS.authErrors.userExists);
      }
      return { needsEmailConfirmation: data.session === null };
    },
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      // scope: 'local' — faqat shu qurilmadan chiqadi, boshqa qurilmalardagi sessiyalar qoladi.
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        throw error;
      }
    },
  });
}
