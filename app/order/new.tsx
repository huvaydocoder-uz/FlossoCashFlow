import { router } from 'expo-router';
import { useState } from 'react';

import { createEmptyOrderValues, OrderForm } from '@/components/orders/OrderForm';
import { Screen } from '@/components/Screen';
import { useAccess } from '@/hooks/useMembership';
import { OrderPartiallySavedError, useSaveOrder } from '@/hooks/useOrders';
import { getDbErrorMessage } from '@/lib/dbErrors';

export default function NewOrderScreen() {
  const save = useSaveOrder();
  const access = useAccess();
  const [initial] = useState(createEmptyOrderValues);

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <OrderForm
        initial={initial}
        isNew
        isOwner={access === 'owner'}
        submitting={save.isPending}
        submitError={save.isError ? getDbErrorMessage(save.error) : null}
        onSubmit={(input) =>
          save.mutate(input, {
            onSuccess: (id) => router.replace({ pathname: '/order/[id]', params: { id } }),
            // Buyurtma yaratilgan bo'lsa — o'shanga o'tamiz (mahsulot/avansni u yerdan qo'shish mumkin).
            onError: (error) => {
              if (error instanceof OrderPartiallySavedError) {
                router.replace({ pathname: '/order/[id]', params: { id: error.orderId } });
              }
            },
          })
        }
      />
    </Screen>
  );
}
