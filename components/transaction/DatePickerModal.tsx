import { useEffect, useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { SIZES } from '@/constants/sizes';
import { TEXTS } from '@/constants/texts';
import { buildMonthGrid, isSameDay, startOfDay, startOfMonth } from '@/lib/dates';

type DatePickerModalProps = {
  visible: boolean;
  value: Date;
  onSelect: (day: Date) => void;
  onClose: () => void;
  // Qarz muddati kabi kelajakdagi sanalar uchun.
  allowFuture?: boolean;
};

// Oddiy oy kalendari. Odatda kelajakdagi kunlarni tanlab bo'lmaydi (allowFuture bilan — mumkin).
export function DatePickerModal({ visible, value, onSelect, onClose, allowFuture = false }: DatePickerModalProps) {
  const [month, setMonth] = useState(() => startOfMonth(value));

  useEffect(() => {
    if (visible) {
      setMonth(startOfMonth(value));
    }
  }, [visible, value]);

  const today = startOfDay(new Date());
  const canGoNext = allowFuture || month < startOfMonth(today);
  const cells = buildMonthGrid(month);
  const monthTitle = `${TEXTS.calendar.months[month.getMonth()] ?? ''} ${month.getFullYear()}`;
  const shiftMonth = (delta: number) =>
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityLabel={TEXTS.calendar.close}
        onPress={onClose}
        className="flex-1 items-center justify-center bg-black/40 px-5"
      >
        <Pressable onPress={() => undefined} className="w-full max-w-[400px] rounded-card bg-surface p-4">
          <Text accessibilityRole="header" className="text-center text-base font-semibold text-ink-muted">
            {TEXTS.calendar.title}
          </Text>

          <View className="mt-3 flex-row items-center justify-between">
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
              accessibilityState={{ disabled: !canGoNext }}
              disabled={!canGoNext}
              hitSlop={SIZES.hitSlop}
              onPress={() => shiftMonth(1)}
              className={`h-10 w-10 items-center justify-center rounded-full active:bg-line ${canGoNext ? '' : 'opacity-30'}`}
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
                return <View key={`empty-${index}`} className="aspect-square w-[14.2857%]" />;
              }
              const selected = isSameDay(day, value);
              const isFuture = !allowFuture && day > today;
              return (
                <Pressable
                  key={day.toISOString()}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: isFuture }}
                  disabled={isFuture}
                  onPress={() => onSelect(day)}
                  className="aspect-square w-[14.2857%] items-center justify-center"
                >
                  <View
                    className={`h-10 w-10 items-center justify-center rounded-full ${selected ? 'bg-primary' : isSameDay(day, today) ? 'border border-primary' : ''}`}
                  >
                    <Text
                      className={`text-base ${selected ? 'font-semibold text-white' : isFuture ? 'text-ink-subtle opacity-50' : 'text-ink'}`}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View className="mt-3 flex-row gap-2">
            <View className="flex-1">
              <Button title={TEXTS.calendar.today} variant="secondary" onPress={() => onSelect(new Date())} />
            </View>
            <View className="flex-1">
              <Button title={TEXTS.calendar.close} variant="ghost" onPress={onClose} />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
