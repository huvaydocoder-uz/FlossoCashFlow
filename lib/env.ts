// Expo faqat to'g'ridan-to'g'ri yozilgan `process.env.EXPO_PUBLIC_*` ni ilovaga
// joylaydi, shuning uchun bu yerda destrukturizatsiya ishlatilmaydi.
const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
const supabaseKey = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

export type EnvError = 'missing' | 'secretKey';

// service_role / secret kalit klientga hech qachon tushmasligi kerak.
function isSecretKey(key: string): boolean {
  if (key.startsWith('sb_secret_')) {
    return true;
  }
  const payload = key.split('.')[1];
  if (payload === undefined) {
    return false;
  }
  try {
    return atob(payload.replace(/-/g, '+').replace(/_/g, '/')).includes('"service_role"');
  } catch {
    return false;
  }
}

function detectEnvError(): EnvError | null {
  if (supabaseUrl.length === 0 || supabaseKey.length === 0) {
    return 'missing';
  }
  if (isSecretKey(supabaseKey)) {
    return 'secretKey';
  }
  return null;
}

export const ENV_ERROR = detectEnvError();

export const ENV = {
  supabaseUrl,
  supabaseKey,
} as const;
