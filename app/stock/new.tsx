import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/Screen';
import { emptyStockValues, StockItemForm } from '@/components/stock/StockItemForm';
import { useSaveStockItem } from '@/hooks/useStock';
import { getDbErrorMessage } from '@/lib/dbErrors';

export default function NewStockItemScreen() {
  const { kind } = useLocalSearchParams<{ kind?: string }>();
  const save = useSaveStockItem();
  const [initial] = useState(() => emptyStockValues(kind === 'material' ? 'material' : 'product'));

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <StockItemForm
        initial={initial}
        isNew
        isSystem={false}
        submitting={save.isPending}
        submitError={save.isError ? getDbErrorMessage(save.error) : null}
        onSubmit={(payload) =>
          save.mutate({ payload }, { onSuccess: (id) => router.replace({ pathname: '/stock/[id]', params: { id } }) })
        }
      />
    </Screen>
  );
}
