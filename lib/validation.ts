import { LIMITS } from '@/constants/limits';
import { TEXTS } from '@/constants/texts';
import { cleanPhone, isPossiblePhone } from '@/lib/phone';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Har bir funksiya xato matnini yoki (to'g'ri bo'lsa) undefined qaytaradi.

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (email.length === 0) {
    return TEXTS.validation.emailRequired;
  }
  return EMAIL_PATTERN.test(email) ? undefined : TEXTS.validation.emailInvalid;
}

// Kirishda: faqat bo'sh emasligini tekshiramiz.
export function validatePasswordRequired(value: string): string | undefined {
  return value.length === 0 ? TEXTS.validation.passwordRequired : undefined;
}

// Yangi parol qoidalari: kamida 8 ta belgi, katta va kichik harf, raqam (maxsus belgi — ixtiyoriy).
export function passwordChecks(value: string): { length: boolean; upper: boolean; lower: boolean; digit: boolean } {
  return {
    length: value.length >= LIMITS.passwordMinLength,
    upper: /\p{Lu}/u.test(value),
    lower: /\p{Ll}/u.test(value),
    digit: /\d/.test(value),
  };
}

// Ro'yxatdan o'tishda: barcha qoidalar bajarilishi shart.
export function validateNewPassword(value: string): string | undefined {
  if (value.length === 0) {
    return TEXTS.validation.passwordRequired;
  }
  const checks = passwordChecks(value);
  if (!checks.length) {
    return TEXTS.validation.passwordTooShort;
  }
  return checks.upper && checks.lower && checks.digit ? undefined : TEXTS.validation.passwordWeak;
}

export function validateFullName(value: string): string | undefined {
  const name = value.trim();
  if (name.length === 0) {
    return TEXTS.validation.fullNameRequired;
  }
  return name.length > LIMITS.fullNameMaxLength ? TEXTS.validation.fullNameTooLong : undefined;
}

export function validateCategoryName(value: string): string | undefined {
  const name = value.trim();
  if (name.length === 0) {
    return TEXTS.validation.categoryNameRequired;
  }
  return name.length > LIMITS.categoryNameMaxLength ? TEXTS.validation.categoryNameTooLong : undefined;
}

export function validateNote(value: string): string | undefined {
  return value.trim().length > LIMITS.noteMaxLength ? TEXTS.validation.noteTooLong : undefined;
}

export function validateCounterparty(value: string): string | undefined {
  const name = value.trim();
  if (name.length === 0) {
    return TEXTS.validation.counterpartyRequired;
  }
  return name.length > LIMITS.counterpartyMaxLength ? TEXTS.validation.counterpartyTooLong : undefined;
}

// Telefon ixtiyoriy: bo'sh bo'lishi mumkin; istalgan davlat raqami (kod bilan yoki +998 deb olinadi).
export function validatePhone(value: string): string | undefined {
  if (cleanPhone(value).length === 0) {
    return undefined;
  }
  return isPossiblePhone(value) ? undefined : TEXTS.validation.phoneInvalid;
}

export function validateSector(value: string): string | undefined {
  return value.trim().length > LIMITS.sectorMaxLength ? TEXTS.validation.sectorTooLong : undefined;
}

export function hasErrors(errors: Record<string, string | undefined>): boolean {
  return Object.values(errors).some((message) => message !== undefined);
}
