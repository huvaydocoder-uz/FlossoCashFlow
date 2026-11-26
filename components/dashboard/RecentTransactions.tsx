import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { EmptyState } from '@/components/states/EmptyState';
import { TransactionRow } from '@/components/transaction/TransactionRow';
import { Card } from '@/components/ui/Card';
import { SIZES } from '@/constants/sizes';
import { TEXTS } from '@/constants/texts';
import type { TransactionListItem } from '@/types/models';

type RecentTransactionsProps = {
  items: TransactionListItem[];
};

export function RecentTransactions({ items }: RecentTransactionsProps) {
  return (
    <View className="mt-6">
      <View className="mb-2 flex-row items-center justify-between">
        <Text accessibilityRole="header" className="text-xl font-bold text-ink">
          {TEXTS.dashboard.recent}
        </Text>
        {items.length > 0 ? (
          <Pressable
            accessibilityRole="link"
            hitSlop={SIZES.hitSlop}
            onPress={() => router.navigate('/history')}
          >
            <Text className="text-base font-medium text-primary">{TEXTS.common.seeAll}</Text>
          </Pressable>
        ) : null}
      </View>

      {items.length === 0 ? (
        <EmptyState title={TEXTS.dashboard.emptyTitle} message={TEXTS.dashboard.emptyMessage} />
      ) : (
        <Card className="py-1">
          {items.map((item, index) => (
            <View key={item.id} className={index > 0 ? 'border-t border-line' : ''}>
              <TransactionRow item={item} />
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}
