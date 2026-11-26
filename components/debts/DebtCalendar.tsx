import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { SIZES } from '@/constants/sizes';
import { TEXTS } from '@/constants/texts';
import { buildMonthGrid, isSameDay, startOfMonth } from '@/lib/dates';
import { getDebtStatus, toDueDateString } from '@/lib/debts';
import type { Debt } from '@/types/database';
import type { DebtStatus } from '@/types/models';

type DebtCalendarProps = {
  debts: Debt[];
  selected: Date | null;
  onSelect: (day: Date | null) => void;
};

const DOT: Record<DebtStatus, string> = {
  overdue: 'bg-expense',
  today: 'bg-warning',
  upcoming: 'bg-primary',
  paid: 'bg-income',
};

// Muhimlik tartibi: kunda bir nechta qarz bo'lsa, eng "xavflisi" rangida nuqta chiqadi.
const PRIORITY: DebtStatus[] = ['overdue', 'today', 'upcoming', 'paid'];

// To'lov muddatlari kalendari: nuqtali kunlarda qarz bor. Kunni bosish — o'sha kunni tanlash.
export function DebtCalendar({ debts, selected, onSelect }: DebtCalendarProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const today = new Date();
  const cells = buildMonthGrid(month);
  const monthTitle = `${TEXTS.calendar.months[month.getMonth()] ?? ''} ${month.getFullYear()}`;

  const byDay = new Map<string, { status: DebtStatus; count: number }>();
  for (const debt of debts) {
    const status = getDebtStatus(debt, today);
    const current = byDay.get(debt.due_date);
    if (current === undefined) {
      byDay.set(debt.due_date, { status, count: 1 });
    } else {
      byDay.set(debt.due_date, {
        status: PRIORITY.indexOf(status) < PRIORITY.indexOf(current.status) ? status : current.status,
        count: current.count + 1,
      });
    }
  }

  const shiftMonth = (delta: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return (
    <Card>
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={TEXTS.calendar.prevMonth}
          hitSlop={SIZES.hitSlop}
          onPress={() => shiftMonth(-1)}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-line"
        >
          <Text className="text-2xl text-primary">‹</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-ink">{monthTitle}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={TEXTS.calendar.nextMonth}
          hitSlop={SIZES.hitSlop}
          onPress={() => shiftMonth(1)}
          className="h-10 w-10 items-center justify-center rounded-full active:bg-line"
        >
          <Text className="text-2xl text-primary">›</Text>
        </Pressable>
      </View>

      <View className="mt-2 flex-row">
        {TEXTS.calendar.weekdays.map((weekday) => (
          <Text key={weekday} className="flex-1 py-1 text-center text-xs font-medium text-ink-subtle">
            {weekday}
          </Text>
        ))}
      </View>

      <View className="flex-row flex-wrap">
        {cells.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} className="h-12 w-[14.2857%]" />;
          }
          const info = byDay.get(toDueDateString(day));
          const isSelected = selected !== null && isSameDay(day, selected);
          const isToday = isSameDay(day, today);
          return (
            <Pressable
              key={day.toISOString()}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`${day.getDate()}${info !== undefined ? `, ${info.count} ${TEXTS.debts.title.toLowerCase()}` : ''}`}
              onPress={() => onSelect(isSelected ? null : day)}
              className="h-12 w-[14.2857%] items-center justify-center"
            >
              <View
                className={`h-9 w-9 items-center justify-center rounded-full ${isSelected ? 'bg-primary' : isToday ? 'border border-primary' : ''}`}
              >
                <Text className={`text-[15px] ${isSelected ? 'font-semibold text-white' : 'text-ink'}`}>
                  {day.getDate()}
                </Text>
              </View>
              <View className={`mt-0.5 h-1.5 w-1.5 rounded-full ${info !== undefined ? DOT[info.status] : ''}`} />
            </Pressable>
          );
        })}
      </View>

      <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
        {(['overdue', 'today', 'upcoming', 'paid'] as const).map((status) => (
          <View key={status} className="flex-row items-center gap-1.5">
            <View className={`h-2 w-2 rounded-full ${DOT[status]}`} />
            <Text className="text-xs text-ink-muted">
              {status === 'overdue'
                ? TEXTS.debts.statusOverdue
                : status === 'today'
                  ? TEXTS.debts.statusToday
                  : status === 'upcoming'
                    ? TEXTS.debts.statusUpcoming
                    : TEXTS.debts.statusPaid}
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
