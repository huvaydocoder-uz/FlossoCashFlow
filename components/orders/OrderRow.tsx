import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { ORDER_STATUS_LABELS } from '@/constants/options';
import { TEXTS } from '@/constants/texts';
import { formatDate } from '@/lib/dates';
import { parseDueDate } from '@/lib/debts';
import { formatMoney } from '@/lib/format';
import { formatOrderNumber } from '@/lib/orders';
import type { OrderStatus } from '@/types/database';
import type { OrderListItem } from '@/types/models';

export const STATUS_BADGE: Record<OrderStatus, { box: string; text: string }> = {
  new: { box: 'bg-warning-soft', text: 'text-warning' },
  delivered: { box: 'bg-income-soft', text: 'text-income' },
  cancelled: { box: 'bg-line', text: 'text-ink-muted' },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const badge = STATUS_BADGE[status];
  return (
    <View className={`rounded-full px-2 py-0.5 ${badge.box}`}>
      <Text className={`text-xs font-semibold ${badge.text}`}>{ORDER_STATUS_LABELS[status]}</Text>
    </View>
  );
}

// Ro'yxatdagi buyurtma: raqam, mijoz, sotuvchi, yetkazish kuni, holat; pul — ko'rish huquqi bo'lsa.
export function OrderRow({ order }: { order: OrderListItem }) {
  const details = [
    order.seller_name,
    order.delivery_date !== null ? `${TEXTS.orders.deliveryDateLabel}: ${formatDate(parseDueDate(order.delivery_date))}` : null,
  ]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
      className="flex-row items-center gap-3 py-3 active:opacity-60"
    >
      <View className="h-11 min-w-[56px] items-center justify-center rounded-control bg-primary-soft px-2">
        <Text className="text-sm font-bold text-primary">{formatOrderNumber(order.number)}</Text>
      </View>
      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-semibold text-ink">
          {order.customer_name}
        </Text>
        {details.length > 0 ? (
          <Text numberOfLines={1} className="text-sm text-ink-muted">
            {details}
          </Text>
        ) : null}
      </View>
      <View className="items-end gap-1">
        {order.remaining !== null && order.currency !== null ? (
          <Text className={`text-sm font-semibold ${order.remaining > 0 ? 'text-expense' : 'text-income'}`}>
            {order.remaining > 0 ? formatMoney(order.remaining, order.currency) : TEXTS.debts.statusPaid}
          </Text>
        ) : null}
        <StatusBadge status={order.status} />
      </View>
    </Pressable>
  );
}
