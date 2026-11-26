import { TEXTS } from '@/constants/texts';

// Oylik hisobi oylar bo'yicha: oy — o'sha oyning 1-kuni (mahalliy vaqt).
export function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function shiftMonth(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1);
}

// Bazaga yuboriladigan oy: "2026-11-01".
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

export function formatMonth(month: Date): string {
  return `${TEXTS.calendar.months[month.getMonth()] ?? ''} ${month.getFullYear()}`;
}
