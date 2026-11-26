import { TEXTS } from '@/constants/texts';
import type { HistoryPeriod } from '@/types/models';

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

// Keyingi mahalliy yarim tungacha qolgan millisekundlar.
export function msUntilNextDay(now: Date): number {
  return addDays(startOfDay(now), 1).getTime() - now.getTime();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

// "7-noyabr" (joriy yil) yoki "7-noyabr, 2025".
export function formatDate(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const month = TEXTS.calendar.monthsGenitive[date.getMonth()] ?? '';
  const base = `${date.getDate()}-${month}`;
  return date.getFullYear() === new Date().getFullYear() ? base : `${base}, ${date.getFullYear()}`;
}

// "Bugun", "Kecha" yoki sana.
export function formatRelativeDay(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const today = new Date();
  if (isSameDay(date, today)) {
    return TEXTS.calendar.today;
  }
  if (isSameDay(date, addDays(today, -1))) {
    return TEXTS.calendar.yesterday;
  }
  return formatDate(date);
}

// "09:05" — 24 soatlik vaqt.
export function formatClock(value: Date | string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

// "Bugun, 21:42". Vaqt faqat amal o'sha kunning o'zida kiritilgan bo'lsa ko'rsatiladi:
// o'tgan sana tanlanganda soat shartli (12:00, moveToDay) — uni ko'rsatish chalg'itadi.
export function formatDayTime(occurredAt: Date | string, createdAt: Date | string): string {
  const occurred = typeof occurredAt === 'string' ? new Date(occurredAt) : occurredAt;
  const created = typeof createdAt === 'string' ? new Date(createdAt) : createdAt;
  const day = formatRelativeDay(occurred);
  return isSameDay(occurred, created) ? `${day}, ${formatClock(occurred)}` : day;
}

// Tanlangan kun uchun saqlanadigan vaqt: bugun bo'lsa hozirgi vaqt,
// boshqa kun bo'lsa soat 12:00 (vaqt zonasi chegarasida kun almashib ketmasligi uchun).
export function moveToDay(day: Date): Date {
  const now = new Date();
  if (isSameDay(day, now)) {
    return now;
  }
  const result = startOfDay(day);
  result.setHours(12);
  return result;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

// Kalendar katakchalari (dushanbadan boshlab). Bo'sh katakchalar — null.
export function buildMonthGrid(month: Date): Array<Date | null> {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const offset = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: Array<Date | null> = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(new Date(year, monthIndex, day));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

// Tarix filtri: davr boshlanish vaqti (ISO) yoki null.
export function periodStart(period: HistoryPeriod): string | null {
  const today = startOfDay(new Date());
  switch (period) {
    case 'today':
      return today.toISOString();
    case 'week':
      return addDays(today, -6).toISOString();
    case 'month':
      return addDays(today, -29).toISOString();
    case 'all':
      return null;
  }
}
