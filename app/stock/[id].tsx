import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { CodeBadge, formatPrice, formatQty, qtyTone } from '@/components/stock/StockSection';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import { PRODUCT_TYPE_LABELS } from '@/constants/options';
import { SIZES } from '@/constants/sizes';
import { TEXTS } from '@/constants/texts';
import { useDeleteMovement, useDeleteStockItem, useStockItems, useStockMovements } from '@/hooks/useStock';
import { confirmDestructive } from '@/lib/confirm';
import { formatDate } from '@/lib/dates';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { formatOrderNumber } from '@/lib/orders';
import type { StockReason } from '@/types/database';

const EDGES = ['bottom', 'left', 'right'] as const;

const REASON_LABEL: Record<StockReason, string> = {
  production: TEXTS.stock.reasonProduction,
  purchase: TEXTS.stock.reasonPurchase,
  writeoff: TEXTS.stock.reasonWriteoff,
  adjustment: TEXTS.stock.reasonAdjustment,
  order: TEXTS.stock.reasonOrder,
};

// Ombor pozitsiyasi: qoldiq, kirim/chiqim, harakatlar tarixi (buyurtma harakatlari — avtomatik).
export default function StockItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const stock = useStockItems();
  const movements = useStockMovements(id);
  const removeMove = useDeleteMovement();
  const remove = useDeleteStockItem();
  const item = stock.data?.find((entry) => entry.id === id);
  const failed = removeMove.error ?? remove.error;

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
      <View className="gap-4 pt-2">
        {failed !== null ? <FormMessage message={getDbErrorMessage(failed)} /> : null}
        <Card className="gap-2">
          <Text className="text-xl font-bold text-ink">{item.name}</Text>
          {item.code !== null || item.product_type !== null || item.price !== null ? (
            <View className="flex-row flex-wrap items-center gap-2">
              {item.code !== null ? <CodeBadge code={item.code} /> : null}
              {item.product_type !== null ? (
                <Text className="text-sm text-ink-muted">{PRODUCT_TYPE_LABELS[item.product_type]}</Text>
              ) : null}
              {item.price !== null ? (
                <Text className="text-sm font-semibold text-ink">{formatPrice(item.price, item.unit)}</Text>
              ) : null}
            </View>
          ) : null}
          <Text className="text-sm text-ink-muted">{TEXTS.stock.balance}</Text>
          <Text className={`text-3xl font-bold ${qtyTone(item)}`}>{formatQty(item.quantity ?? 0, item.unit)}</Text>
          {item.min_qty > 0 ? (
            <Text className="text-sm text-ink-muted">
              {TEXTS.stock.minLabel}: {formatQty(item.min_qty, item.unit)}
            </Text>
          ) : null}
          <View className="mt-2 flex-row gap-2">
            <Button
              title={TEXTS.stock.addIn}
              onPress={() => router.push({ pathname: '/stock/move/[id]', params: { id, dir: 'in' } })}
              className="flex-1"
            />
            <Button
              title={TEXTS.stock.addOut}
              variant="secondary"
              onPress={() => router.push({ pathname: '/stock/move/[id]', params: { id, dir: 'out' } })}
              className="flex-1"
            />
          </View>
        </Card>

        <View className="gap-2">
          <Text accessibilityRole="header" className="text-lg font-bold text-ink">
            {TEXTS.stock.movements}
          </Text>
          {movements.isPending ? (
            <LoadingState />
          ) : movements.isError ? (
            <ErrorState onRetry={() => void movements.refetch()} />
          ) : movements.data.length === 0 ? (
            <Text className="text-sm text-ink-muted">{TEXTS.stock.noMovements}</Text>
          ) : (
            <Card className="py-1">
              {movements.data.map((move, index) => {
                const orderId = move.order_id;
                return (
                  <View key={move.id} className={`flex-row items-center gap-3 py-3 ${index > 0 ? 'border-t border-line' : ''}`}>
                    <Pressable
                      className="flex-1"
                      disabled={orderId === null}
                      onPress={() => orderId !== null && router.push({ pathname: '/order/[id]', params: { id: orderId } })}
                    >
                      <Text className={`text-base font-semibold ${move.direction === 'in' ? 'text-income' : 'text-expense'}`}>
                        {move.direction === 'in' ? '+' : '−'}
                        {formatQty(move.quantity, item.unit)}
                      </Text>
                      <Text className="text-sm text-ink-muted">
                        {[
                          formatDate(move.moved_at),
                          REASON_LABEL[move.reason],
                          move.order !== null ? formatOrderNumber(move.order.number) : null,
                          move.note,
                        ]
                          .filter((part) => part !== null && part !== '')
                          .join(' · ')}
                      </Text>
                    </Pressable>
                    {move.reason !== 'order' ? (
                      <Pressable
                        accessibilityRole="button"
                        hitSlop={SIZES.hitSlop}
                        onPress={() =>
                          confirmDestructive({
                            title: TEXTS.stock.deleteMoveTitle,
                            message: TEXTS.stock.deleteMoveMessage,
                            confirmLabel: TEXTS.common.delete,
                            onConfirm: () => removeMove.mutate(move.id),
                          })
                        }
                        className="rounded-full bg-danger-soft px-3 py-1.5 active:opacity-70"
                      >
                        <Text className="text-sm font-semibold text-danger">{TEXTS.common.delete}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </Card>
          )}
        </View>

        <Button
          title={TEXTS.orders.edit}
          variant="secondary"
          onPress={() => router.push({ pathname: '/stock/edit/[id]', params: { id } })}
        />
        {item.system_key === null ? (
          <Button
            title={TEXTS.stock.delete}
            variant="danger"
            loading={remove.isPending}
            onPress={() =>
              confirmDestructive({
                title: TEXTS.stock.deleteTitle,
                message: TEXTS.stock.deleteMessage,
                confirmLabel: TEXTS.common.delete,
                onConfirm: () => remove.mutate(id, { onSuccess: () => router.back() }),
              })
            }
          />
        ) : null}
      </View>
    </Screen>
  );
}
