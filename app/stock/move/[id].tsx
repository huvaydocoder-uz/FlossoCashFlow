import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { DateField } from '@/components/transaction/DateField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { TEXTS } from '@/constants/texts';
import { useAddMovement, useStockItems } from '@/hooks/useStock';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { formatAmountInput, parseAmountInput } from '@/lib/format';
import type { StockReason } from '@/types/database';

const EDGES = ['bottom', 'left', 'right'] as const;
type ManualReason = Exclude<StockReason, 'order'>;

const REASONS: Record<'in' | 'out', ReadonlyArray<[ManualReason, string]>> = {
  in: [
    ['production', TEXTS.stock.reasonProduction],
    ['purchase', TEXTS.stock.reasonPurchase],
    ['adjustment', TEXTS.stock.reasonAdjustment],
  ],
  out: [
    ['writeoff', TEXTS.stock.reasonWriteoff],
    ['adjustment', TEXTS.stock.reasonAdjustment],
  ],
};

// Qo'lda kirim (ishlab chiqarish, xarid) yoki chiqim (hisobdan chiqarish, tuzatish).
export default function StockMoveScreen() {
  const params = useLocalSearchParams<{ id: string; dir?: string }>();
  const direction = params.dir === 'out' ? 'out' : 'in';
  const stock = useStockItems();
  const add = useAddMovement();
  const item = stock.data?.find((entry) => entry.id === params.id);
  const [quantityText, setQuantityText] = useState('');
  const [reason, setReason] = useState<ManualReason>(direction === 'in' ? 'production' : 'writeoff');
  const [note, setNote] = useState('');
  const [movedAt, setMovedAt] = useState(() => new Date());
  const [error, setError] = useState<string>();

  if (item === undefined) {
    return (
      <Screen edges={[...EDGES]}>
        {stock.isError ? (
          <ErrorState onRetry={() => void stock.refetch()} />
        ) : stock.isPending ? (
          <LoadingState />
        ) : (
          <EmptyState title={TEXTS.stock.title} message={TEXTS.orders.notFoundMessage} />
        )}
      </Screen>
    );
  }

  const submit = () => {
    const quantity = parseAmountInput(quantityText);
    if (quantity === null || quantity <= 0) {
      setError(TEXTS.stock.quantityRequired);
      return;
    }
    const trimmed = note.trim();
    add.mutate(
      { itemId: item.id, direction, quantity, reason, note: trimmed.length > 0 ? trimmed : null, movedAt },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen edges={[...EDGES]}>
      <View className="gap-5 pt-2">
        <Card className="gap-1">
          <Text className="text-lg font-semibold text-ink">
            {direction === 'in' ? TEXTS.stock.moveInTitle : TEXTS.stock.moveOutTitle} · {item.name}
          </Text>
        </Card>
        {add.isError ? <FormMessage message={getDbErrorMessage(add.error)} /> : null}
        <Input
          label={`${TEXTS.stock.quantityLabel} (${item.unit})`}
          value={quantityText}
          onChangeText={(text) => {
            setQuantityText(formatAmountInput(text));
            setError(undefined);
          }}
          error={error}
          keyboardType="decimal-pad"
          className="text-[22px] font-semibold"
        />
        <View className="gap-2">
          <Text className="text-sm font-medium text-ink">{TEXTS.stock.reasonLabel}</Text>
          <View className="flex-row flex-wrap gap-2">
            {REASONS[direction].map(([value, label]) => (
              <Chip key={value} label={label} selected={reason === value} onPress={() => setReason(value)} />
            ))}
          </View>
        </View>
        <Input label={TEXTS.stock.noteLabel} value={note} onChangeText={setNote} maxLength={300} />
        <DateField label={TEXTS.stock.dateLabel} value={movedAt} onChange={setMovedAt} />
        <Button title={TEXTS.common.save} loading={add.isPending} onPress={submit} />
      </View>
    </Screen>
  );
}
