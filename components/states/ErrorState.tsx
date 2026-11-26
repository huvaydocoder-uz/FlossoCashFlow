import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { TEXTS } from '@/constants/texts';

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title = TEXTS.common.errorTitle,
  message = TEXTS.common.errorMessage,
  onRetry,
}: ErrorStateProps) {
  return (
    <View accessibilityRole="alert" className="flex-1 items-center justify-center px-6 py-16">
      <Text className="text-center text-lg font-semibold text-ink">{title}</Text>
      <Text className="mt-2 text-center text-base text-ink-muted">{message}</Text>
      {onRetry ? (
        <Button
          title={TEXTS.common.retry}
          variant="secondary"
          onPress={onRetry}
          className="mt-6 self-stretch"
        />
      ) : null}
    </View>
  );
}
