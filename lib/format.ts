import { TEXTS } from '@/constants/texts';
import type { CurrencyCode, TransactionType } from '@/types/database';

const NBSP = ' ';
const MINUS = '−';

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

// 1250000 -> "1 250 000 so'm", 1250.5 -> "$1 250,50". Kasr qismi faqat bo'lsa ko'rsatiladi.
export function formatMoney(amount: number, currency: CurrencyCode): string {
  const [intPart = '0', fraction = '00'] = Math.abs(amount).toFixed(2).split('.');
  const value = `${groupThousands(intPart)}${fraction === '00' ? '' : `,${fraction}`}`;
  const sign = amount < 0 ? MINUS : '';
  return currency === 'USD'
    ? `${sign}${TEXTS.money.usdPrefix}${value}`
    : `${sign}${value}${NBSP}${TEXTS.money.uzsSuffix}`;
}

// Tranzaksiya summasi ishorasi bilan: kirim "+", chiqim "−".
export function formatSignedMoney(amount: number, currency: CurrencyCode, type: TransactionType): string {
  return `${type === 'income' ? '+' : MINUS}${formatMoney(amount, currency)}`;
}

// Kiritilayotgan summani chiroyli ko'rsatadi: "1250000,5" -> "1 250 000,5".
export function formatAmountInput(text: string): string {
  const cleaned = text.replace(/[^\d.,]/g, '');
  const separatorIndex = cleaned.search(/[.,]/);
  const intDigits = (separatorIndex === -1 ? cleaned : cleaned.slice(0, separatorIndex))
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '')
    .slice(0, 16);
  if (separatorIndex === -1) {
    return groupThousands(intDigits);
  }
  const fraction = cleaned.slice(separatorIndex + 1).replace(/\D/g, '').slice(0, 2);
  return `${groupThousands(intDigits === '' ? '0' : intDigits)},${fraction}`;
}

// Formatlangan matndan songa: "1 250 000,5" -> 1250000.5. Noto'g'ri bo'lsa null.
export function parseAmountInput(text: string): number | null {
  const normalized = text.replace(/\s| /g, '').replace(',', '.');
  if (!/^\d{1,16}(\.\d{0,2})?$/.test(normalized)) {
    return null;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
