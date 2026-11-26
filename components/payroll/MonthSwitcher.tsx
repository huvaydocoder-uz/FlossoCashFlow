import { Pressable, Text, View } from 'react-native';

import { SIZES } from '@/constants/sizes';
import { TEXTS } from '@/constants/texts';
import { formatMonth, shiftMonth } from '@/lib/months';

// ‹ Noyabr 2026 › — oylik hisobi oyini tanlash.
export function MonthSwitcher({ month, onChange }: { month: Date; onChange: (month: Date) => void }) {
  return (
    <View className="flex-row items-center justify-between rounded-control bg-surface px-2 py-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={TEXTS.calendar.prevMonth}
        hitSlop={SIZES.hitSlop}
        onPress={() => onChange(shiftMonth(month, -1))}
        className="h-10 w-10 items-center justify-center rounded-full active:bg-line"
      >
        <Text className="text-2xl text-primary">‹</Text>
      </Pressable>
      <Text className="text-lg font-semibold text-ink">{formatMonth(month)}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={TEXTS.calendar.nextMonth}
        hitSlop={SIZES.hitSlop}
        onPress={() => onChange(shiftMonth(month, 1))}
        className="h-10 w-10 items-center justify-center rounded-full active:bg-line"
      >
        <Text className="text-2xl text-primary">›</Text>
      </Pressable>
    </View>
  );
}
