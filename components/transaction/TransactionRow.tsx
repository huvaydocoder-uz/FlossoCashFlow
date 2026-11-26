import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { TEXTS } from '@/constants/texts';
import { formatDayTime } from '@/lib/dates';
import { formatSignedMoney } from '@/lib/format';
import type { TransactionListItem } from '@/types/models';

type TransactionRowProps = {
  item: TransactionListItem;
};

// Ro'yxatdagi bitta amal. Bosilsa — tahrirlash oynasi ochiladi.
export function TransactionRow({ item }: TransactionRowProps) {
  const isIncome = item.type === 'income';
  const title = item.category?.name ?? TEXTS.transaction.uncategorized;
  const note = item.note?.trim() ?? '';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: item.id } })}
      className="flex-row items-center gap-3 py-3 active:opacity-60"
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-full ${isIncome ? 'bg-income-soft' : 'bg-expense-soft'}`}
      >
        <Text className={`text-lg font-bold ${isIncome ? 'text-income' : 'text-expense'}`}>
          {isIncome ? '↓' : '↑'}
        </Text>
      </View>

      <View className="flex-1">
        <Text numberOfLines={1} className="text-base font-medium text-ink">
          {title}
        </Text>
        <Text numberOfLines={1} className="text-sm text-ink-muted">
          {note.length > 0 ? note : TEXTS.types[item.type]}
        </Text>
      </View>

      <View className="items-end">
        <Text className={`text-base font-semibold ${isIncome ? 'text-income' : 'text-expense'}`}>
          {formatSignedMoney(item.amount, item.currency, item.type)}
        </Text>
        <Text className="text-xs text-ink-subtle">
          {TEXTS.paymentMethods[item.payment_method]} · {formatDayTime(item.occurred_at, item.created_at)}
        </Text>
      </View>
    </Pressable>
  );
}
