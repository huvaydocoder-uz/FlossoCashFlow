import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { AddCategoryForm } from '@/components/categories/AddCategoryForm';
import { Chip } from '@/components/ui/Chip';
import { COLORS } from '@/constants/colors';
import { TEXTS } from '@/constants/texts';
import { useCategories } from '@/hooks/useCategories';
import type { TransactionType } from '@/types/database';

type CategoryPickerProps = {
  type: TransactionType;
  value: string | null;
  onChange: (categoryId: string) => void;
  error?: string;
};

// Tanlangan turga (kirim/chiqim) mos kategoriyalar + joyida yangisini qo'shish.
export function CategoryPicker({ type, value, onChange, error }: CategoryPickerProps) {
  const categories = useCategories();
  const [adding, setAdding] = useState(false);
  const items = categories.data?.filter((category) => category.type === type) ?? [];

  const renderOptions = () => {
    if (categories.isPending) {
      return <ActivityIndicator color={COLORS.primary.DEFAULT} className="self-start" />;
    }
    if (categories.isError) {
      return (
        <Pressable accessibilityRole="button" onPress={() => void categories.refetch()}>
          <Text className="text-sm text-danger">
            {TEXTS.common.errorTitle}. {TEXTS.common.retry}
          </Text>
        </Pressable>
      );
    }
    return (
      <>
        <View className="flex-row flex-wrap gap-2">
          {items.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              tone={type}
              selected={category.id === value}
              onPress={() => onChange(category.id)}
            />
          ))}
          <Chip label={TEXTS.transaction.newCategory} selected={adding} onPress={() => setAdding((v) => !v)} />
        </View>
        {items.length === 0 && !adding ? (
          <Text className="text-sm text-ink-muted">{TEXTS.transaction.noCategories}</Text>
        ) : null}
      </>
    );
  };

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-ink">{TEXTS.transaction.categoryLabel}</Text>
      {renderOptions()}
      {adding ? (
        <AddCategoryForm
          key={type}
          type={type}
          placeholder={TEXTS.transaction.newCategoryPlaceholder}
          autoFocus
          onCreated={(category) => {
            onChange(category.id);
            setAdding(false);
          }}
        />
      ) : null}
      {error !== undefined ? <Text className="text-sm text-danger">{error}</Text> : null}
    </View>
  );
}
