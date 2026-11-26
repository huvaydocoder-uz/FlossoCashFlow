/// <reference types="expo/types" />

// .env dagi o'zgaruvchilar tiplari (qiymatlar faqat .env faylida).
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  }
}
