import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { StockItemForm, toStockValues } from '@/components/stock/StockItemForm';
import { TEXTS } from '@/constants/texts';
import { useSaveStockItem, useStockItems } from '@/hooks/useStock';
import { getDbErrorMessage } from '@/lib/dbErrors';

const EDGES = ['bottom', 'left', 'right'] as const;

export default function EditStockItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stock = useStockItems();
  const save = useSaveStockItem();
  const item = stock.data?.find((entry) => entry.id === id);

  if (stock.isPending) {
    return (
      <Screen edges={[...EDGES]}>
        <LoadingState />
      </Screen>
    );
  }
  if (stock.isError) {
    return (
      <Screen edges={[...EDGES]}>
        <ErrorState onRetry={() => void stock.refetch()} />
      </Screen>
    );
  }
  if (item === undefined) {
    return (
      <Screen edges={[...EDGES]}>
        <EmptyState title={TEXTS.stock.title} message={TEXTS.orders.notFoundMessage} />
      </Screen>
    );
  }
  return (
    <Screen edges={[...EDGES]}>
      <StockItemForm
        initial={toStockValues(item)}
        isNew={false}
        isSystem={item.system_key !== null}
        submitting={save.isPending}
        submitError={save.isError ? getDbErrorMessage(save.error) : null}
        onSubmit={(payload) => save.mutate({ id, payload }, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
