import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { DatePickerModal } from '@/components/transaction/DatePickerModal';
import { TEXTS } from '@/constants/texts';
import { addDays, formatDate, formatRelativeDay, isSameDay, moveToDay } from '@/lib/dates';

type DateFieldProps = {
  value: Date;
  onChange: (value: Date) => void;
  label?: string;
  allowFuture?: boolean;
};

function describe(value: Date): string {
  const relative = isSameDay(value, addDays(new Date(), 1)) ? TEXTS.calendar.tomorrow : formatRelativeDay(value);
  const full = formatDate(value);
  return relative === full ? full : `${relative}, ${full}`;
}

export function DateField({ value, onChange, label = TEXTS.transaction.dateLabel, allowFuture = false }: DateFieldProps) {
  const [open, setOpen] = useState(false);

  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium text-ink">{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${describe(value)}`}
        onPress={() => setOpen(true)}
        className="min-h-control flex-row items-center justify-between rounded-control border border-line bg-surface px-4 active:opacity-70"
      >
        <Text className="text-[16px] text-ink">{describe(value)}</Text>
        <Text className="text-xl text-ink-subtle">›</Text>
      </Pressable>

      <DatePickerModal
        visible={open}
        value={value}
        allowFuture={allowFuture}
        onClose={() => setOpen(false)}
        onSelect={(day) => {
          // Kun o'zgarmasa, asl vaqtni saqlaymiz.
          onChange(isSameDay(day, value) ? value : moveToDay(day));
          setOpen(false);
        }}
      />
    </View>
  );
}
