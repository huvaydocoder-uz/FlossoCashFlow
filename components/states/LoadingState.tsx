import { ActivityIndicator, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { TEXTS } from '@/constants/texts';

type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = TEXTS.common.loading }: LoadingStateProps) {
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      className="flex-1 items-center justify-center gap-3 py-16"
    >
      <ActivityIndicator size="large" color={COLORS.primary.DEFAULT} />
      <Text className="text-base text-ink-muted">{message}</Text>
    </View>
  );
}
