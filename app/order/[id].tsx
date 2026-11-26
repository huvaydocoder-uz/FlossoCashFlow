import { router, useLocalSearchParams } from 'expo-router';
import type { ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';

import { callPhone, ProgressBar } from '@/components/debts/DebtRow';
import { StatusBadge } from '@/components/orders/OrderRow';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import { PRODUCT_TYPE_LABELS } from '@/constants/options';
import { SIZES } from '@/constants/sizes';
import { TEXTS } from '@/constants/texts';
import { useAccess } from '@/hooks/useMembership';
import { useDeleteOrder, useDeleteOrderPayment, useOrder, useSetOrderStatus } from '@/hooks/useOrders';
import { useStockItems } from '@/hooks/useStock';
import { confirmDestructive } from '@/lib/confirm';
import { formatDate } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { parseDueDate } from '@/lib/debts';
import { formatMoney } from '@/lib/format';
import { formatOrderNumber, yandexMapsUrl } from '@/lib/orders';
import type { OrderDetail, OrderPaymentItem } from '@/types/models';

const EDGES = ['bottom', 'left', 'right'] as const;

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);

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
  if (order.data === null) {
    return (
      <Screen edges={[...EDGES]}>
        <EmptyState title={TEXTS.orders.notFoundTitle} message={TEXTS.orders.notFoundMessage} />
      </Screen>
    );
  }
  return <OrderDetails order={order.data} />;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="text-sm text-ink-muted">{label}</Text>
      <Text className="flex-1 text-right text-sm font-medium text-ink">{children}</Text>
    </View>
  );
}

function OrderDetails({ order }: { order: OrderDetail }) {
  const access = useAccess();
  const isOwner = access === 'owner';
  const canEdit = order.can_see_money;
  const setStatus = useSetOrderStatus();
  const remove = useDeleteOrder();
  const removePayment = useDeleteOrderPayment();
  const stock = useStockItems();
  const stockById = new Map((stock.data ?? []).map((entry) => [entry.id, entry]));
  const failed = setStatus.error ?? remove.error ?? removePayment.error;
  const mapUrl = yandexMapsUrl(order);
  const phone = order.phone;
  const due = order.agreed_price !== null && order.discount !== null ? order.agreed_price - order.discount : null;
  const yesNo = (value: boolean) => (value ? TEXTS.orders.yes : TEXTS.orders.no);

  const confirmDeletePayment = (payment: OrderPaymentItem) =>
    confirmDestructive({
      title: TEXTS.orders.deletePaymentConfirmTitle,
      message: `${formatMoney(payment.amount, payment.currency)} · ${formatDate(payment.paid_at)}\n${TEXTS.orders.deletePaymentConfirmMessage}`,
      confirmLabel: TEXTS.common.delete,
      onConfirm: () => removePayment.mutate(payment.id),
    });

  return (
    <Screen edges={[...EDGES]}>
      <View className="gap-4 pt-2">
        {failed !== null ? <FormMessage message={getDbErrorMessage(failed)} /> : null}

        <Card className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text className="text-2xl font-bold text-primary">{formatOrderNumber(order.number)}</Text>
            <StatusBadge status={order.status} />
          </View>
          <Text className="text-xl font-bold text-ink">{order.customer_name}</Text>
          {order.seller_name !== null ? <Row label={TEXTS.orders.sellerLabel}>{order.seller_name}</Row> : null}
          <Row label={TEXTS.orders.orderDateLabel}>{formatDate(parseDueDate(order.order_date))}</Row>
          <Row label={TEXTS.orders.deliveryDateLabel}>
            {order.delivery_date === null ? TEXTS.orders.noDelivery : formatDate(parseDueDate(order.delivery_date))}
          </Row>
          {order.address !== null ? <Row label={TEXTS.orders.addressLabel}>{order.address}</Row> : null}
          {phone !== null ? (
            <Button title={`${TEXTS.orders.call} · ${formatPhone(phone)}`} variant="secondary" onPress={() => callPhone(phone)} />
          ) : null}
          {mapUrl !== null ? (
            <Button title={TEXTS.orders.openMap} variant="secondary" onPress={() => void Linking.openURL(mapUrl)} />
          ) : null}
        </Card>

        {canEdit && order.currency !== null && due !== null ? (
          <Card className="gap-3">
            <Text accessibilityRole="header" className="text-lg font-bold text-ink">
              {TEXTS.orders.sectionPrice}
            </Text>
            <Row label={TEXTS.orders.priceLabel}>{formatMoney(order.agreed_price ?? 0, order.currency)}</Row>
            {(order.discount ?? 0) > 0 ? (
              <Row label={TEXTS.orders.discountLabel}>{formatMoney(order.discount ?? 0, order.currency)}</Row>
            ) : null}
            <Row label={TEXTS.orders.paidLabel}>{formatMoney(order.paid ?? 0, order.currency)}</Row>
            <Text numberOfLines={1} adjustsFontSizeToFit className={`text-2xl font-bold ${(order.remaining ?? 0) > 0 ? 'text-expense' : 'text-income'}`}>
              {TEXTS.orders.remainingLabel}: {formatMoney(order.remaining ?? 0, order.currency)}
            </Text>
            <ProgressBar ratio={due > 0 ? Math.min((order.paid ?? 0) / due, 1) : 1} tone="income" />
            {(order.remaining ?? 0) > 0 && order.status !== 'cancelled' ? (
              <Button
                title={TEXTS.orders.addPayment}
                onPress={() => router.push({ pathname: '/order/pay/[id]', params: { id: order.id } })}
              />
            ) : null}

            <Text className="mt-2 text-base font-semibold text-ink">{TEXTS.orders.payments}</Text>
            {order.payments.length === 0 ? (
              <Text className="text-sm text-ink-muted">{TEXTS.orders.noPayments}</Text>
            ) : (
              order.payments.map((payment, index) => (
                <View key={payment.id} className={`flex-row items-center gap-3 py-2 ${index > 0 ? 'border-t border-line' : ''}`}>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-ink">
                      {formatMoney(payment.amount, payment.currency)}
                      {payment.is_advance ? ` · ${TEXTS.orders.advanceBadge}` : ''}
                    </Text>
                    <Text className="text-sm text-ink-muted">
                      {formatDate(payment.paid_at)} · {TEXTS.paymentMethods[payment.payment_method]} · 1 $ ={' '}
                      {formatMoney(payment.rate_uzs_per_usd, 'UZS')}
                    </Text>
                  </View>
                  {isOwner ? (
                    <Pressable
                      accessibilityRole="button"
                      hitSlop={SIZES.hitSlop}
                      onPress={() => confirmDeletePayment(payment)}
                      className="rounded-full bg-danger-soft px-3 py-1.5 active:opacity-70"
                    >
                      <Text className="text-sm font-semibold text-danger">{TEXTS.common.delete}</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
          </Card>
        ) : (
          <FormMessage message={TEXTS.orders.hiddenMoney} />
        )}

        <Card className="gap-2">
          <Text accessibilityRole="header" className="text-lg font-bold text-ink">
            {TEXTS.orders.sectionProducts}
          </Text>
          {order.items.length === 0 ? (
            <Text className="text-sm text-ink-muted">—</Text>
          ) : (
            order.items.map((item) => {
              const stockItem = item.stock_item_id === null ? undefined : stockById.get(item.stock_item_id);
              const code = stockItem?.code ?? null;
              return (
                <Row
                  key={item.id}
                  label={[PRODUCT_TYPE_LABELS[item.product_type], item.name, code].filter((part) => part !== null && part !== undefined).join(' · ')}
                >
                  {item.quantity} {stockItem?.unit ?? TEXTS.stock.unitPiece}
                </Row>
              );
            })
          )}
        </Card>

        <Card className="gap-2">
          <Text accessibilityRole="header" className="text-lg font-bold text-ink">
            {TEXTS.orders.sectionExtras}
          </Text>
          <Row label={TEXTS.orders.freeDelivery}>{yesNo(order.free_delivery)}</Row>
          <Row label={TEXTS.orders.installation}>{yesNo(order.installation)}</Row>
          <Row label={TEXTS.orders.training}>{yesNo(order.training)}</Row>
          <Row label={TEXTS.orders.molds}>{yesNo(order.molds)}</Row>
        </Card>

        {order.note !== null ? (
          <Card className="gap-1">
            <Text className="text-sm text-ink-muted">{TEXTS.orders.noteLabel}</Text>
            <Text className="text-base text-ink">{order.note}</Text>
          </Card>
        ) : null}

        {canEdit ? (
          <View className="gap-3">
            <Button
              title={TEXTS.orders.edit}
              variant="secondary"
              onPress={() => router.push({ pathname: '/order/edit/[id]', params: { id: order.id } })}
            />
            {order.status === 'new' ? (
              <Button
                title={TEXTS.orders.markDelivered}
                loading={setStatus.isPending}
                onPress={() => setStatus.mutate({ id: order.id, status: 'delivered' })}
              />
            ) : (
              <Button
                title={TEXTS.orders.markNew}
                variant="secondary"
                loading={setStatus.isPending}
                onPress={() => setStatus.mutate({ id: order.id, status: 'new' })}
              />
            )}
            {order.status !== 'cancelled' ? (
              <Button
                title={TEXTS.orders.cancel}
                variant="ghost"
                onPress={() =>
                  confirmDestructive({
                    title: TEXTS.orders.cancelConfirmTitle,
                    message: TEXTS.orders.cancelConfirmMessage,
                    confirmLabel: TEXTS.orders.cancel,
                    onConfirm: () => setStatus.mutate({ id: order.id, status: 'cancelled' }),
                  })
                }
              />
            ) : null}
          </View>
        ) : null}

        {isOwner ? (
          <Button
            title={TEXTS.orders.delete}
            variant="danger"
            loading={remove.isPending}
            onPress={() =>
              confirmDestructive({
                title: TEXTS.orders.deleteConfirmTitle,
                message: TEXTS.orders.deleteConfirmMessage,
                confirmLabel: TEXTS.common.delete,
                onConfirm: () => remove.mutate(order.id, { onSuccess: () => router.back() }),
              })
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}
