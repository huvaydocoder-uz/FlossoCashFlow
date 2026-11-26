import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';

type EmptyStateProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6 py-16">
      <Text className="text-center text-lg font-semibold text-ink">{title}</Text>
      <Text className="mt-2 text-center text-base text-ink-muted">{message}</Text>
      {actionLabel !== undefined && onAction ? (
        <Button title={actionLabel} onPress={onAction} className="mt-6 self-stretch" />
      ) : null}
    </View>
  );
}
