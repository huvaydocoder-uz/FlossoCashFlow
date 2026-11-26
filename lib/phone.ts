import { AsYouType, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

// "+" siz kiritilgan raqam — O'zbekiston raqami deb olinadi.
const DEFAULT_COUNTRY: CountryCode = 'UZ';

// iPhone kontaktlaridan nusxa olinganda raqam atrofida ko'rinmas yo'nalish belgilari
// (U+202A…U+202E, U+2066…U+2069) va maxsus bo'shliqlar keladi — ularni tozalaymiz.
export function cleanPhone(text: string): string {
  return text
    .replace(/[‎‏‪-‮⁦-⁩﻿]/g, '')
    .replace(/[   ]/g, ' ')
    .trim();
}

function parse(text: string) {
  const cleaned = cleanPhone(text);
  if (cleaned.length === 0) {
    return undefined;
  }
  return parsePhoneNumberFromString(cleaned, DEFAULT_COUNTRY);
}

// Bazaga yoziladigan ko'rinish (E.164): "+992 55 263 6262" -> "+992552636262". Noto'g'ri bo'lsa null.
export function normalizePhone(text: string): string | null {
  const phone = parse(text);
  return phone !== undefined && phone.isPossible() ? phone.number : null;
}

export function isPossiblePhone(text: string): boolean {
  return normalizePhone(text) !== null;
}

// Raqamdagi davlat (kiritish davomida ham): "+992 55" -> "TJ". "+" bo'lmasa — null.
export function phoneCountry(text: string): CountryCode | null {
  const cleaned = cleanPhone(text);
  if (!cleaned.startsWith('+')) {
    return null;
  }
  const full = parsePhoneNumberFromString(cleaned);
  if (full?.country !== undefined) {
    return full.country;
  }
  const typing = new AsYouType();
  typing.input(cleaned);
  return typing.getCountry() ?? null;
}

// Ko'rsatish uchun: "+992552636262" -> "+992 55 263 6262" (tanib bo'lmasa — o'zi).
export function formatPhone(value: string): string {
  const phone = parse(value);
  return phone !== undefined && phone.isPossible() ? phone.formatInternational() : cleanPhone(value);
}

// Bayroq rasmi (Windows brauzerlarida bayroq emoji ko'rinmaydi).
export function flagUrl(country: string): string {
  return `https://flagcdn.com/w40/${country.toLowerCase()}.png`;
}

// Telefon raqamidan qo'ng'iroq havolasi: "+998 (90) 123-45-67" -> "tel:+998901234567".
export function phoneHref(phone: string): string {
  return `tel:${normalizePhone(phone) ?? cleanPhone(phone).replace(/[^+0-9]/g, '')}`;
}
