import { TEXTS } from '@/constants/texts';
import { addDays, startOfDay } from '@/lib/dates';

// Hisobot davrlari: oxirgi kun/hafta/oy… (sirpanuvchi), kesimlarga (bucket) bo'lingan.
export type ReportPeriod = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year';

export const REPORT_PERIODS: ReadonlyArray<{ value: ReportPeriod; label: string }> = [
  { value: 'day', label: TEXTS.charts.periodDay },
  { value: 'week', label: TEXTS.charts.periodWeek },
  { value: 'month', label: TEXTS.charts.periodMonth },
  { value: 'quarter', label: TEXTS.charts.periodQuarter },
  { value: 'half', label: TEXTS.charts.periodHalf },
  { value: 'year', label: TEXTS.charts.periodYear },
];

export const DEFAULT_REPORT_PERIOD: ReportPeriod = 'month';

export type ReportBucket = {
  key: string;
  label: string;
  start: Date;
  // end — keyingi kesim boshi (kiritilmaydi).
  end: Date;
  income: number;
  expense: number;
};

type ReportRow = { type: 'income' | 'expense'; amount: number; occurred_at: string };

const MONTH_COUNT: Record<'quarter' | 'half' | 'year', number> = { quarter: 3, half: 6, year: 12 };

const pad = (value: number) => String(value).padStart(2, '0');
const dayMonth = (date: Date) => `${pad(date.getDate())}.${pad(date.getMonth() + 1)}`;

function bucket(start: Date, end: Date, label: string): ReportBucket {
  return { key: start.toISOString(), label, start, end, income: 0, expense: 0 };
}

export function createReportBuckets(period: ReportPeriod, now: Date): ReportBucket[] {
  const today = startOfDay(now);

  switch (period) {
    case 'day':
      return Array.from({ length: 6 }, (_, i) => {
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), i * 4);
        const end = new Date(today.getFullYear(), today.getMonth(), today.getDate(), i * 4 + 4);
        return bucket(start, end, `${pad(i * 4)}:00–${pad(i * 4 + 4)}:00`);
      });
    case 'week':
      return Array.from({ length: 7 }, (_, i) => {
        const start = addDays(today, i - 6);
        const weekday = TEXTS.calendar.weekdays[(start.getDay() + 6) % 7] ?? '';
        return bucket(start, addDays(start, 1), `${weekday}, ${dayMonth(start)}`);
      });
    case 'month':
      return Array.from({ length: 5 }, (_, i) => {
        const start = addDays(today, i * 7 - 34);
        return bucket(start, addDays(start, 7), `${dayMonth(start)}–${dayMonth(addDays(start, 6))}`);
      });
    case 'quarter':
    case 'half':
    case 'year': {
      const count = MONTH_COUNT[period];
      return Array.from({ length: count }, (_, i) => {
        const start = new Date(today.getFullYear(), today.getMonth() - (count - 1) + i, 1);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
        const name = TEXTS.calendar.months[start.getMonth()] ?? '';
        const label = start.getFullYear() === today.getFullYear() ? name : `${name} ${start.getFullYear()}`;
        return bucket(start, end, label);
      });
    }
  }
}

export function reportRangeStart(period: ReportPeriod, now: Date): Date {
  const first = createReportBuckets(period, now)[0];
  return first === undefined ? startOfDay(now) : first.start;
}

// Har bir amal start <= vaqt < end bo'lgan kesimga qo'shiladi; davrdan tashqaridagilar e'tiborsiz.
export function fillReportBuckets(buckets: ReportBucket[], rows: ReadonlyArray<ReportRow>): ReportBucket[] {
  const filled = buckets.map((item) => ({ ...item }));
  for (const row of rows) {
    const time = new Date(row.occurred_at).getTime();
    const target = filled.find((item) => item.start.getTime() <= time && time < item.end.getTime());
    if (target !== undefined) {
      target[row.type] += row.amount;
    }
  }
  return filled;
}
