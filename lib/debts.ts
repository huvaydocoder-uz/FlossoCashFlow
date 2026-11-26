import { addDays, startOfDay } from '@/lib/dates';
import { toOrderCurrency } from '@/lib/orders';
import type { CurrencyCode, Debt } from '@/types/database';
import type { DebtStatus } from '@/types/models';

type ProgressInput = {
  amount: number;
  currency?: CurrencyCode;
  payments: ReadonlyArray<{ amount: number; currency?: CurrencyCode; rate_uzs_per_usd?: number | null }>;
};

// To'lov qarz valyutasida (boshqa valyutada bo'lsa — to'lovga muhrlangan kurs bilan).
function inDebtCurrency(debtCurrency: CurrencyCode | undefined, payment: ProgressInput['payments'][number]): number {
  if (debtCurrency === undefined || payment.currency === undefined || payment.currency === debtCurrency) {
    return payment.amount;
  }
  return toOrderCurrency(payment.amount, payment.currency, debtCurrency, payment.rate_uzs_per_usd ?? 1);
}

// To'langan, qoldiq va ulush. Hisob tiyinlarda — kasr xatolari to'planmasin.
export function debtProgress(debt: ProgressInput): { paid: number; remaining: number; ratio: number } {
  const total = Math.round(debt.amount * 100);
  // Bazadagi debt_paid_total kabi: avval yig'indi, keyin bir marta yaxlitlash.
  const paid = Math.round(debt.payments.reduce((sum, item) => sum + inDebtCurrency(debt.currency, item), 0) * 100);
  const remaining = Math.max(total - paid, 0);
  return {
    paid: paid / 100,
    remaining: remaining / 100,
    ratio: total > 0 ? Math.min(paid / total, 1) : 0,
  };
}

// Qoldiqni boshqa valyutada to'lash uchun summa — yuqoriga yaxlitlanadi (aks holda bir necha
// so'm ochiq qolib ketadi). Bazadagi tekshiruv bir sentdan kam ortiqchani qabul qiladi.
export function payInCurrency(remaining: number, debtCurrency: CurrencyCode, payCurrency: CurrencyCode, rate: number): number {
  if (payCurrency === debtCurrency) {
    return remaining;
  }
  return Math.ceil(Math.round(toOrderCurrency(remaining, debtCurrency, payCurrency, rate) * 1e6) / 1e4) / 100;
}

// Bazadagi add_debt_payment bilan bir xil qoida: shu valyutada — aniq; boshqa valyutada —
// ortiqcha qism to'lov valyutasining bir sentidan kam bo'lsa, qabul qilinadi.
export function exceedsRemaining(
  amount: number,
  payCurrency: CurrencyCode,
  debtCurrency: CurrencyCode,
  rate: number | null,
  remaining: number,
): boolean {
  if (payCurrency === debtCurrency) {
    return Math.round(amount * 100) > Math.round(remaining * 100);
  }
  if (rate === null) {
    return false;
  }
  return toOrderCurrency(amount - 0.01, payCurrency, debtCurrency, rate) > remaining + 1e-9;
}

// "2026-11-20" (bazadagi date) -> mahalliy vaqt bo'yicha o'sha kun 00:00.
export function parseDueDate(value: string): Date {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Mahalliy kun -> "2026-11-20" (vaqt zonasi siljimasligi uchun toISOString ishlatilmaydi).
export function toDueDateString(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// Muddatgacha qolgan kunlar (manfiy — muddati o'tgan).
export function daysUntil(due: string, today: Date = new Date()): number {
  const ms = parseDueDate(due).getTime() - startOfDay(today).getTime();
  return Math.round(ms / 86_400_000);
}

export function getDebtStatus(debt: Pick<Debt, 'paid_at' | 'due_date'>, today: Date = new Date()): DebtStatus {
  if (debt.paid_at !== null) {
    return 'paid';
  }
  const days = daysUntil(debt.due_date, today);
  if (days < 0) {
    return 'overdue';
  }
  return days === 0 ? 'today' : 'upcoming';
}

// Dashboard eslatmasi uchun: muddati o'tgan, bugungi va yaqin kunlardagi to'lanmagan qarzlar.
export function groupReminders<T extends Debt>(debts: T[], soonDays = 3) {
  const today = new Date();
  const open = debts.filter((debt) => debt.paid_at === null);
  const limit = toDueDateString(addDays(today, soonDays));
  return {
    overdue: open.filter((debt) => getDebtStatus(debt, today) === 'overdue'),
    today: open.filter((debt) => getDebtStatus(debt, today) === 'today'),
    soon: open.filter((debt) => getDebtStatus(debt, today) === 'upcoming' && debt.due_date <= limit),
  };
}
