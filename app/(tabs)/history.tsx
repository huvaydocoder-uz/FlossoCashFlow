import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { OwnerOnly } from '@/components/OwnerOnly';
import { HistoryFilters } from '@/components/history/HistoryFilters';
import { ScreenTitle } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { TransactionRow } from '@/components/transaction/TransactionRow';
import { COLORS } from '@/constants/colors';
import { TEXTS } from '@/constants/texts';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useTransactionList } from '@/hooks/useTransactions';
import { hasActiveFilters, useHistoryFilters } from '@/store/historyFilters';

const SEARCH_DELAY_MS = 350;

// Tarix: barcha amallar, qidiruv va filtrlar bilan, sahifalab yuklanadi.
export default function HistoryScreenRoute() {
  return (
    <OwnerOnly>
      <HistoryScreen />
    </OwnerOnly>
  );
}

function HistoryScreen() {
  const filters = useHistoryFilters((state) => state.filters);
  const resetFilters = useHistoryFilters((state) => state.reset);
  const search = useDebouncedValue(filters.search, SEARCH_DELAY_MS);
  const list = useTransactionList({ ...filters, search });
  const { refreshing, onRefresh } = useManualRefresh([list.refetch]);
  const items = list.data?.pages.flat() ?? [];
  const filtered = hasActiveFilters(filters);

  const renderEmpty = () => {
    if (list.isPending) {
      return <LoadingState />;
    }
    if (list.isError) {
      return <ErrorState onRetry={() => void list.refetch()} />;
    }
    return (
      <EmptyState
        title={TEXTS.history.emptyTitle}
        message={filtered ? TEXTS.history.emptyFilteredMessage : TEXTS.history.emptyMessage}
        actionLabel={filtered ? TEXTS.history.clearFilters : undefined}
        onAction={filtered ? resetFilters : undefined}
      />
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: COLORS.background }}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TransactionRow item={item} />}
        ItemSeparatorComponent={() => <View className="h-px bg-line" />}
        ListHeaderComponent={
          <View className="pt-2">
            <ScreenTitle title={TEXTS.history.title} />
            <HistoryFilters />
          </View>
        }
        ListEmptyComponent={renderEmpty()}
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator className="py-4" color={COLORS.primary.DEFAULT} />
          ) : undefined
        }
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage) {
            void list.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary.DEFAULT} />
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerClassName="flex-grow px-5 pb-8"
      />
    </SafeAreaView>
  );
}
