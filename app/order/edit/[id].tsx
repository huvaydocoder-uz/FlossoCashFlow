import { router, useLocalSearchParams } from 'expo-router';

import { OrderForm, toOrderValues } from '@/components/orders/OrderForm';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { TEXTS } from '@/constants/texts';
import { useAccess } from '@/hooks/useMembership';
import { useOrder, useSaveOrder } from '@/hooks/useOrders';
import { getDbErrorMessage } from '@/lib/dbErrors';

const EDGES = ['bottom', 'left', 'right'] as const;

export default function EditOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);
  const save = useSaveOrder();
  const access = useAccess();

  if (order.isPending) {
    return (
      <Screen edges={[...EDGES]}>
        <LoadingState />
      </Screen>
    );
  }
  if (order.isError) {
    return (
      <Screen edges={[...EDGES]}>
        <ErrorState onRetry={() => void order.refetch()} />
      </Screen>
    );
  }
  // Tahrirlash faqat egasi va buyurtma sotuvchisiga (bazada ham shunday).
  if (order.data === null || !order.data.can_see_money) {
    return (
      <Screen edges={[...EDGES]}>
        <EmptyState title={TEXTS.orders.notFoundTitle} message={TEXTS.orders.notFoundMessage} />
      </Screen>
    );
  }

  return (
    <Screen edges={[...EDGES]}>
      <OrderForm
        key={order.data.updated_at}
        initial={toOrderValues(order.data)}
        isNew={false}
        isOwner={access === 'owner'}
        submitting={save.isPending}
        submitError={save.isError ? getDbErrorMessage(save.error) : null}
        onSubmit={(input) => save.mutate({ id, payload: input.payload, items: input.items }, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
