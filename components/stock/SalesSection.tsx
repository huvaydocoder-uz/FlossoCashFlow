import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { formatQty } from '@/components/stock/StockSection';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { PRODUCT_TYPE_LABELS } from '@/constants/options';
import { TEXTS } from '@/constants/texts';
import { useSalesReport } from '@/hooks/useStock';
import { toDueDateString } from '@/lib/debts';
import { formatMoney } from '@/lib/format';
import { formatMonth, monthStart, shiftMonth } from '@/lib/months';
import type { SalesReportRow } from '@/types/database';

type Period = 1 | 3 | 6 | 12;
const PERIODS: ReadonlyArray<[Period, string]> = [
  [1, TEXTS.sales.periodMonth],
  [3, TEXTS.sales.period3],
  [6, TEXTS.sales.period6],
  [12, TEXTS.sales.periodYear],
];
const TYPE_LABEL = PRODUCT_TYPE_LABELS;

function money(uzs: number, usd: number): string {
  const parts = [usd !== 0 ? formatMoney(usd, 'USD') : null, uzs !== 0 ? formatMoney(uzs, 'UZS') : null].filter(
    (part) => part !== null,
  );
  return parts.length > 0 ? parts.join(' + ') : '0';
}

function sum(rows: SalesReportRow[], key: keyof SalesReportRow): number {
  return rows.reduce((total, row) => total + Number(row[key] ?? 0), 0);
}

function Summary({ rows, title }: { rows: SalesReportRow[]; title: string }) {
  return (
    <View className="gap-1">
      <Text className="text-base font-semibold text-ink">{title}</Text>
      <Text className="text-sm text-ink-muted">
        {TEXTS.sales.orders}: {sum(rows, 'orders_count')} ({sum(rows, 'delivered_count')} {TEXTS.sales.delivered},{' '}
        {sum(rows, 'cancelled_count')} {TEXTS.sales.cancelled})
      </Text>
      <Text className="text-sm text-ink">
        {TEXTS.sales.agreed}: {money(sum(rows, 'agreed_uzs'), sum(rows, 'agreed_usd'))}
      </Text>
      <Text className="text-sm font-semibold text-income">
        {TEXTS.sales.paid}: {formatMoney(sum(rows, 'paid_usd'), 'USD')}
      </Text>
      <Text className="text-sm font-semibold text-expense">
        {TEXTS.sales.remaining}: {money(sum(rows, 'remaining_uzs'), sum(rows, 'remaining_usd'))}
      </Text>
    </View>
  );
}

// Egasi: sotuv hisoboti — oylar va sotuvchilar kesimida, eng ko'p sotilgan mahsulotlar.
export function SalesSection() {
  const [period, setPeriod] = useState<Period>(1);
  const range = useMemo(() => {
    const to = new Date();
    return { from: toDueDateString(shiftMonth(monthStart(to), -(period - 1))), to: toDueDateString(to) };
  }, [period]);
  const report = useSalesReport(range.from, range.to);

  const content = () => {
    if (report.isPending) {
      return <LoadingState />;
    }
    if (report.isError) {
      return <ErrorState onRetry={() => void report.refetch()} />;
    }
    const { rows, top } = report.data;
    if (rows.length === 0) {
      return <EmptyState title={TEXTS.sales.title} message={TEXTS.sales.empty} />;
    }
    const months = [...new Set(rows.map((row) => row.month))];
    const sellers = [...new Set(rows.map((row) => row.seller_id ?? ''))];
    return (
      <View className="gap-4">
        <Card>
          <Summary rows={rows} title={TEXTS.sales.total} />
        </Card>

        <Text accessibilityRole="header" className="text-lg font-bold text-ink">
          {TEXTS.sales.bySeller}
        </Text>
        <Card className="gap-4">
          {sellers.map((seller) => {
            const own = rows.filter((row) => (row.seller_id ?? '') === seller);
            return <Summary key={seller} rows={own} title={own[0]?.seller_name ?? TEXTS.sales.noSeller} />;
          })}
        </Card>

        {months.length > 1
          ? months.map((month) => (
              <Card key={month}>
                <Summary
                  rows={rows.filter((row) => row.month === month)}
                  title={formatMonth(new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1))}
                />
              </Card>
            ))
          : null}

        {top.length > 0 ? (
          <View className="gap-2">
            <Text accessibilityRole="header" className="text-lg font-bold text-ink">
              {TEXTS.sales.topProducts}
            </Text>
            <Card className="py-1">
              {top.map((item, index) => (
                <View
                  key={`${item.stock_item_id ?? item.name}-${index}`}
                  className={`flex-row items-center justify-between gap-3 py-2 ${index > 0 ? 'border-t border-line' : ''}`}
                >
                  <Text numberOfLines={1} className="flex-1 text-sm text-ink">
                    {TYPE_LABEL[item.product_type]} · {item.name}
                  </Text>
                  <Text className="text-sm font-semibold text-ink">{formatQty(item.quantity, 'dona')}</Text>
                </View>
              ))}
            </Card>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View className="gap-4">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
        {PERIODS.map(([value, label]) => (
          <Chip key={value} label={label} selected={period === value} onPress={() => setPeriod(value)} />
        ))}
      </ScrollView>
      {content()}
    </View>
  );
}
