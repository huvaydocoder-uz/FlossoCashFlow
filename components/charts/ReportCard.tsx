import { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { COLORS } from '@/constants/colors';
import { CURRENCY_OPTIONS, TYPE_OPTIONS } from '@/constants/options';
import { TEXTS } from '@/constants/texts';
import { useStats } from '@/hooks/useStats';
import { useToday } from '@/hooks/useToday';
import { formatMoney } from '@/lib/format';
import {
  createReportBuckets,
  DEFAULT_REPORT_PERIOD,
  fillReportBuckets,
  REPORT_PERIODS,
  type ReportPeriod,
} from '@/lib/reportPeriods';
import type { CurrencyCode, TransactionType } from '@/types/database';

function Bar({ value, max, color, label }: { value: number; max: number; color: string; label: string }) {
  const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <View className="flex-row items-center gap-2">
      <View className="h-3 flex-1 overflow-hidden rounded-full bg-line">
        <View style={{ width: `${width}%`, backgroundColor: color }} className="h-3 rounded-full" />
      </View>
      <Text numberOfLines={1} className="w-[46%] text-right text-[13px] font-semibold" style={{ color }}>
        {label}
      </Text>
    </View>
  );
}

// Hisobot: oylar/haftalar kesimida kirim-chiqim va kategoriyalar bo'yicha taqsimot — aniq summalar bilan.
export function ReportCard() {
  const [period, setPeriod] = useState<ReportPeriod>(DEFAULT_REPORT_PERIOD);
  const [currency, setCurrency] = useState<CurrencyCode>('UZS');
  const [type, setType] = useState<TransactionType>('expense');
  // Kesimlar davr yoki kun almashganda qayta hisoblanadi — so'rov kaliti (since) shu orada barqaror.
  const today = useToday();
  const emptyBuckets = useMemo(() => createReportBuckets(period, new Date(today)), [period, today]);
  const since = emptyBuckets[0]?.start ?? new Date();
  const stats = useStats(since);

  const rows = (stats.data ?? []).filter((row) => row.currency === currency);
  const buckets = fillReportBuckets(emptyBuckets, rows);
  const maxBucket = Math.max(0, ...buckets.flatMap((bucket) => [bucket.income, bucket.expense]));
  const income = rows.filter((row) => row.type === 'income').reduce((sum, row) => sum + row.amount, 0);
  const expense = rows.filter((row) => row.type === 'expense').reduce((sum, row) => sum + row.amount, 0);

  const byCategory = new Map<string, number>();
  for (const row of rows) {
    if (row.type === type) {
      const name = row.category?.name ?? TEXTS.charts.uncategorized;
      byCategory.set(name, (byCategory.get(name) ?? 0) + row.amount);
    }
  }
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);
  const categoryTotal = type === 'income' ? income : expense;
  const maxCategory = categoryRows[0]?.[1] ?? 0;
  const typeColor = type === 'income' ? COLORS.income.DEFAULT : COLORS.expense.DEFAULT;

  return (
    <View className="mt-6 gap-3">
      <Text accessibilityRole="header" className="text-xl font-bold text-ink">
        {TEXTS.charts.title}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {REPORT_PERIODS.map((item) => (
          <Chip key={item.value} label={item.label} selected={period === item.value} onPress={() => setPeriod(item.value)} />
        ))}
      </ScrollView>
      <SegmentedControl options={CURRENCY_OPTIONS} value={currency} onChange={setCurrency} />

      {stats.isPending ? (
        <ActivityIndicator color={COLORS.primary.DEFAULT} className="py-6" />
      ) : stats.isError ? (
        <Text className="py-4 text-center text-sm text-danger">{TEXTS.common.errorMessage}</Text>
      ) : (
        <>
          <View className="flex-row gap-2">
            {(
              [
                [TEXTS.types.income, income, 'text-income'],
                [TEXTS.types.expense, expense, 'text-expense'],
                [TEXTS.charts.net, income - expense, income - expense < 0 ? 'text-expense' : 'text-ink'],
              ] as const
            ).map(([label, value, color]) => (
              <Card key={label} className="flex-1 p-3">
                <Text className="text-xs font-medium text-ink-muted">{label}</Text>
                <Text numberOfLines={1} adjustsFontSizeToFit className={`text-[15px] font-bold ${color}`}>
                  {formatMoney(value, currency)}
                </Text>
              </Card>
            ))}
          </View>

          <Card className="gap-3">
            <Text className="text-base font-semibold text-ink">{TEXTS.charts.monthly}</Text>
            {rows.length === 0 ? (
              <Text className="text-sm text-ink-muted">{TEXTS.charts.noData}</Text>
            ) : (
              buckets.map((bucket) => (
                <View key={bucket.key} className="gap-1">
                  <Text className="text-xs font-medium text-ink-muted">{bucket.label}</Text>
                  <Bar
                    value={bucket.income}
                    max={maxBucket}
                    color={COLORS.income.DEFAULT}
                    label={`+${formatMoney(bucket.income, currency)}`}
                  />
                  <Bar
                    value={bucket.expense}
                    max={maxBucket}
                    color={COLORS.expense.DEFAULT}
                    label={`−${formatMoney(bucket.expense, currency)}`}
                  />
                </View>
              ))
            )}
          </Card>

          <Card className="gap-3">
            <Text className="text-base font-semibold text-ink">{TEXTS.charts.byCategory}</Text>
            <SegmentedControl options={TYPE_OPTIONS} value={type} onChange={setType} />
            {categoryRows.length === 0 ? (
              <Text className="text-sm text-ink-muted">{TEXTS.charts.noData}</Text>
            ) : (
              categoryRows.map(([name, value]) => (
                <View key={name} className="gap-1">
                  <View className="flex-row justify-between gap-2">
                    <Text numberOfLines={1} className="flex-1 text-sm text-ink">
                      {name}
                    </Text>
                    <Text className="text-sm font-medium text-ink-muted">
                      {categoryTotal > 0 ? `${((value / categoryTotal) * 100).toFixed(1).replace('.', ',')}%` : ''}
                    </Text>
                  </View>
                  <Bar value={value} max={maxCategory} color={typeColor} label={formatMoney(value, currency)} />
                </View>
              ))
            )}
          </Card>
        </>
      )}
    </View>
  );
}
