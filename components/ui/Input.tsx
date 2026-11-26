import type { ComponentRef, Ref } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { COLORS } from '@/constants/colors';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
};

export function Input({ label, error, className = '', ref, ...rest }: InputProps) {
  const hasError = error !== undefined && error.length > 0;

  return (
    <View className="gap-1.5">
      {label !== undefined ? <Text className="text-sm font-medium text-ink">{label}</Text> : null}
      <TextInput
        ref={ref}
        accessibilityLabel={label ?? rest.placeholder}
        accessibilityHint={hasError ? error : undefined}
        placeholderTextColor={COLORS.ink.subtle}
        className={`min-h-control rounded-control border bg-surface px-4 text-[16px] text-ink focus:border-primary ${hasError ? 'border-danger' : 'border-line'} ${className}`}
        {...rest}
      />
      {hasError ? <Text className="text-sm text-danger">{error}</Text> : null}
    </View>
  );
}
