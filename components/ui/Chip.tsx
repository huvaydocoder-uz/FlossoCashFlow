import { Pressable, Text } from 'react-native';

import type { Tone } from '@/components/ui/SegmentedControl';

type ChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  tone?: Tone;
};

const SELECTED: Record<Tone, string> = {
  primary: 'border-primary bg-primary-soft',
  income: 'border-income bg-income-soft',
  expense: 'border-expense bg-expense-soft',
};

const SELECTED_TEXT: Record<Tone, string> = {
  primary: 'text-primary',
  income: 'text-income',
  expense: 'text-expense',
};

export function Chip({ label, selected, onPress, tone = 'primary' }: ChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      className={`min-h-[40px] justify-center rounded-full border px-4 active:opacity-70 ${selected ? SELECTED[tone] : 'border-line bg-surface'}`}
    >
      <Text
        numberOfLines={1}
        className={`text-[15px] font-medium ${selected ? SELECTED_TEXT[tone] : 'text-ink'}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
