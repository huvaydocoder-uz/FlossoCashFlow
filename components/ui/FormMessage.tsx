import { Text, View } from 'react-native';

type FormMessageProps = {
  message: string;
  variant?: 'error' | 'success';
};

// Forma ustida chiqadigan umumiy xabar (server xatosi yoki muvaffaqiyat).
export function FormMessage({ message, variant = 'error' }: FormMessageProps) {
  const isError = variant === 'error';

  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      className={`rounded-control px-4 py-3 ${isError ? 'bg-danger-soft' : 'bg-income-soft'}`}
    >
      <Text className={`text-[15px] leading-5 ${isError ? 'text-danger' : 'text-income'}`}>
        {message}
      </Text>
    </View>
  );
}
