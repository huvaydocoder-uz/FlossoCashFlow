import { useState } from 'react';
import { View } from 'react-native';

import { AddCategoryForm } from '@/components/categories/AddCategoryForm';
import { CategoryRow } from '@/components/categories/CategoryRow';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TYPE_OPTIONS } from '@/constants/options';
import { TEXTS } from '@/constants/texts';
import { useCategories, useDeleteCategory } from '@/hooks/useCategories';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { confirmDestructive } from '@/lib/confirm';
import { getDbErrorMessage } from '@/lib/dbErrors';
import type { Category, TransactionType } from '@/types/database';

export default function CategoriesScreen() {
  const [type, setType] = useState<TransactionType>('expense');
  const categories = useCategories();
  const remove = useDeleteCategory();
  const { refreshing, onRefresh } = useManualRefresh([categories.refetch]);

  const confirmDelete = (category: Category) => {
    confirmDestructive({
      title: TEXTS.categories.deleteConfirmTitle,
      message: `«${category.name}»\n${TEXTS.categories.deleteConfirmMessage}`,
      confirmLabel: TEXTS.common.delete,
      onConfirm: () => remove.mutate(category.id),
    });
  };

  const renderContent = () => {
    if (categories.isPending) {
      return <LoadingState />;
    }
    if (categories.isError) {
      return <ErrorState onRetry={() => void categories.refetch()} />;
    }
    const items = categories.data.filter((category) => category.type === type);
    if (items.length === 0) {
      return <EmptyState title={TEXTS.categories.emptyTitle} message={TEXTS.categories.emptyMessage} />;
    }
    return (
      <Card className="py-1">
        {items.map((category, index) => (
          <View key={category.id} className={index > 0 ? 'border-t border-line' : ''}>
            <CategoryRow
              name={category.name}
              deleting={remove.isPending && remove.variables === category.id}
              onDelete={() => confirmDelete(category)}
            />
          </View>
        ))}
      </Card>
    );
  };

  return (
    <Screen edges={['bottom', 'left', 'right']} refreshing={refreshing} onRefresh={onRefresh}>
      <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} />
      <View className="mt-4">
        <AddCategoryForm type={type} />
      </View>
      {remove.isError ? (
        <View className="mt-3">
          <FormMessage message={getDbErrorMessage(remove.error)} />
        </View>
      ) : null}
      <View className="mt-4 flex-1">{renderContent()}</View>
    </Screen>
  );
}
