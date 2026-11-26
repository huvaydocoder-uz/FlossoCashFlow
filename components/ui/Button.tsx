import { ActivityIndicator, Pressable, Text, type PressableProps } from 'react-native';

import { COLORS } from '@/constants/colors';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
};

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-primary active:bg-primary-pressed',
  secondary: 'bg-primary-soft active:opacity-80',
  ghost: 'bg-transparent active:opacity-60',
  danger: 'bg-danger-soft active:opacity-80',
};

const LABEL: Record<ButtonVariant, string> = {
  primary: 'text-white',
  secondary: 'text-primary',
  ghost: 'text-primary',
  danger: 'text-danger',
};

const SPINNER: Record<ButtonVariant, string> = {
  primary: COLORS.white,
  secondary: COLORS.primary.DEFAULT,
  ghost: COLORS.primary.DEFAULT,
  danger: COLORS.danger.DEFAULT,
};

export function Button({
  title,
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled === true || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={`min-h-control flex-row items-center justify-center rounded-control px-5 ${CONTAINER[variant]} ${isDisabled ? 'opacity-50' : ''} ${className}`}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={SPINNER[variant]} />
      ) : (
        <Text className={`text-[16px] font-semibold ${LABEL[variant]}`}>{title}</Text>
      )}
    </Pressable>
  );
}
