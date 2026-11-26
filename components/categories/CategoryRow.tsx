import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { COLORS } from '@/constants/colors';
import { SIZES } from '@/constants/sizes';
import { TEXTS } from '@/constants/texts';

type CategoryRowProps = {
  name: string;
  deleting: boolean;
  onDelete: () => void;
};

export function CategoryRow({ name, deleting, onDelete }: CategoryRowProps) {
  return (
    <View className="min-h-[52px] flex-row items-center gap-3">
      <Text numberOfLines={1} className="flex-1 text-base text-ink">
        {name}
      </Text>
      {deleting ? (
        <ActivityIndicator color={COLORS.danger.DEFAULT} />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${TEXTS.common.delete}: ${name}`}
          hitSlop={SIZES.hitSlop}
          onPress={onDelete}
          className="rounded-full px-3 py-1.5 active:bg-danger-soft"
        >
          <Text className="text-sm font-medium text-danger">{TEXTS.common.delete}</Text>
        </Pressable>
      )}
    </View>
  );
}
