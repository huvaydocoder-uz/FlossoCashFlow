import { Pressable, Text, View } from 'react-native';

export type Tone = 'primary' | 'income' | 'expense';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  tone?: Tone;
};

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

const SELECTED_TEXT: Record<Tone, string> = {
  primary: 'text-primary',
  income: 'text-income',
  expense: 'text-expense',
};

// iOS uslubidagi bo'limli tanlagich (masalan: Chiqim | Kirim).
export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View accessibilityRole="tablist" className="flex-row rounded-control bg-line p-1">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            className={`min-h-[40px] flex-1 items-center justify-center rounded-[10px] ${selected ? 'bg-surface' : ''}`}
          >
            <Text
              className={`text-[15px] font-semibold ${selected ? SELECTED_TEXT[option.tone ?? 'primary'] : 'text-ink-muted'}`}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
