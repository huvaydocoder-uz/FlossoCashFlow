import { ScrollView, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { SegmentedControl, type SegmentOption } from '@/components/ui/SegmentedControl';
import { TEXTS } from '@/constants/texts';
import { useCategories } from '@/hooks/useCategories';
import { useHistoryFilters } from '@/store/historyFilters';
import type { CurrencyCode, PaymentMethod, TransactionType } from '@/types/database';
import type { HistoryPeriod } from '@/types/models';

const TYPE_FILTER: readonly SegmentOption<TransactionType | 'all'>[] = [
  { value: 'all', label: TEXTS.common.all },
  { value: 'income', label: TEXTS.types.income, tone: 'income' },
  { value: 'expense', label: TEXTS.types.expense, tone: 'expense' },
];

const CURRENCY_CHIPS: ReadonlyArray<{ value: CurrencyCode; label: string }> = [
  { value: 'UZS', label: TEXTS.currencies.UZS },
  { value: 'USD', label: TEXTS.currencies.USD },
];

const METHOD_CHIPS: ReadonlyArray<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: TEXTS.paymentMethods.cash },
  { value: 'card', label: TEXTS.paymentMethods.card },
];

const PERIOD_CHIPS: ReadonlyArray<{ value: Exclude<HistoryPeriod, 'all'>; label: string }> = [
  { value: 'today', label: TEXTS.history.periodToday },
  { value: 'week', label: TEXTS.history.periodWeek },
  { value: 'month', label: TEXTS.history.periodMonth },
];

// Qidiruv va filtrlar. Tanlangan chipni qayta bossangiz — filtr olib tashlanadi.
export function HistoryFilters() {
  const filters = useHistoryFilters((state) => state.filters);
  const setFilter = useHistoryFilters((state) => state.setFilter);
  const categories = useCategories();
  const visibleCategories = (categories.data ?? []).filter(
    (category) => filters.type === 'all' || category.type === filters.type,
  );

  return (
    <View className="gap-3 pb-3">
      <Input
        placeholder={TEXTS.history.searchPlaceholder}
        value={filters.search}
        onChangeText={(search) => setFilter('search', search)}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
      />
      <SegmentedControl
        options={TYPE_FILTER}
        value={filters.type}
        onChange={(type) => {
          setFilter('type', type);
          setFilter('categoryId', 'all');
        }}
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {CURRENCY_CHIPS.map((chip) => (
          <Chip
            key={chip.value}
            label={chip.label}
            selected={filters.currency === chip.value}
            onPress={() => setFilter('currency', filters.currency === chip.value ? 'all' : chip.value)}
          />
        ))}
        {METHOD_CHIPS.map((chip) => (
          <Chip
            key={chip.value}
            label={chip.label}
            selected={filters.paymentMethod === chip.value}
            onPress={() =>
              setFilter('paymentMethod', filters.paymentMethod === chip.value ? 'all' : chip.value)
            }
          />
        ))}
        {PERIOD_CHIPS.map((chip) => (
          <Chip
            key={chip.value}
            label={chip.label}
            selected={filters.period === chip.value}
            onPress={() => setFilter('period', filters.period === chip.value ? 'all' : chip.value)}
          />
        ))}
      </ScrollView>
      {visibleCategories.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
          {visibleCategories.map((category) => (
            <Chip
              key={category.id}
              label={category.name}
              tone={category.type}
              selected={filters.categoryId === category.id}
              onPress={() =>
                setFilter('categoryId', filters.categoryId === category.id ? 'all' : category.id)
              }
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}
