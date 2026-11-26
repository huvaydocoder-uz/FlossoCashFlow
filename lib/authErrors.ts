import { isAuthError, isAuthRetryableFetchError } from '@supabase/supabase-js';

import { TEXTS } from '@/constants/texts';

// Matni tayyor bo'lgan xato (masalan, Supabase xato qaytarmagan, lekin biz aniqlagan holat).
export class AuthMessageError extends Error {}

const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_credentials: TEXTS.authErrors.invalidCredentials,
  email_not_confirmed: TEXTS.authErrors.emailNotConfirmed,
  user_already_exists: TEXTS.authErrors.userExists,
  email_exists: TEXTS.authErrors.userExists,
  weak_password: TEXTS.authErrors.weakPassword,
  email_address_invalid: TEXTS.validation.emailInvalid,
  over_email_send_rate_limit: TEXTS.authErrors.rateLimit,
  over_request_rate_limit: TEXTS.authErrors.rateLimit,
  signup_disabled: TEXTS.authErrors.signupDisabled,
};

// Supabase xatosini foydalanuvchiga tushunarli o'zbekcha matnga aylantiradi.
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof AuthMessageError) {
    return error.message;
  }
  if (isAuthRetryableFetchError(error)) {
    return TEXTS.authErrors.network;
  }
  if (isAuthError(error) && error.code !== undefined) {
    return MESSAGES_BY_CODE[error.code] ?? TEXTS.authErrors.unknown;
  }
  if (error instanceof TypeError) {
    // fetch tarmoqqa ulana olmasa TypeError ("Network request failed") tashlaydi.
    return TEXTS.authErrors.network;
  }
  return TEXTS.authErrors.unknown;
}
