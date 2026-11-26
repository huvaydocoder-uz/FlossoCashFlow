import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { OwnerOnly } from '@/components/OwnerOnly';
import { DebtCalendar } from '@/components/debts/DebtCalendar';
import { DebtRow } from '@/components/debts/DebtRow';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SegmentedControl, type SegmentOption } from '@/components/ui/SegmentedControl';
import { TEXTS } from '@/constants/texts';
import { useDebts } from '@/hooks/useDebts';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { formatDate } from '@/lib/dates';
import { debtProgress, toDueDateString } from '@/lib/debts';
import { formatMoney } from '@/lib/format';
import type { CurrencyCode, DebtDirection } from '@/types/database';
import type { DebtWithPayments } from '@/types/models';

const DIRECTION_FILTER: readonly SegmentOption<DebtDirection | 'all'>[] = [
  { value: 'all', label: TEXTS.common.all },
  { value: 'payable', label: TEXTS.debts.payable, tone: 'expense' },
  { value: 'receivable', label: TEXTS.debts.receivable, tone: 'income' },
];

type StatusFilter = 'open' | 'paid' | 'all';

// To'lanmagan qoldiqlar yig'indisi (bo'lib to'langanlari ayirilgan).
function openTotals(debts: DebtWithPayments[], direction: DebtDirection): Record<CurrencyCode, number> {
  const totals: Record<CurrencyCode, number> = { UZS: 0, USD: 0 };
  for (const debt of debts) {
    if (debt.direction === direction && debt.paid_at === null) {
      totals[debt.currency] += debtProgress(debt).remaining;
    }
  }
  return totals;
}

// Bosilsa — shu turdagi to'lanmagan qarzlar ro'yxati (tahrirlash va to'lash bilan).
function TotalCard({
  title,
  totals,
  tone,
  direction,
}: {
  title: string;
  totals: Record<CurrencyCode, number>;
  tone: 'income' | 'expense';
  direction: DebtDirection;
}) {
  const color = tone === 'income' ? 'text-income' : 'text-expense';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={TEXTS.debts.openListHint}
      onPress={() => router.push({ pathname: '/debt/list/[direction]', params: { direction } })}
      className="flex-1 active:opacity-70"
    >
      <Card className="flex-1 gap-1 p-3">
        <Text className="text-xs font-medium text-ink-muted">
          {title} · {TEXTS.debts.openTotal}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit className={`text-[17px] font-bold ${color}`}>
          {formatMoney(totals.UZS, 'UZS')}
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit className={`text-[15px] font-semibold ${color}`}>
          {formatMoney(totals.USD, 'USD')}
        </Text>
        <Text className="mt-1 text-xs font-semibold text-primary">{TEXTS.debts.openList} ›</Text>
      </Card>
    </Pressable>
  );
}

// Qarzlar: jami summalar, to'lov kalendari va ro'yxat.
export default function DebtsScreenRoute() {
  return (
    <OwnerOnly>
      <DebtsScreen />
    </OwnerOnly>
  );
}

function DebtsScreen() {
  const debts = useDebts();
  const { refreshing, onRefresh } = useManualRefresh([debts.refetch]);
  const [direction, setDirection] = useState<DebtDirection | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('open');
  const [day, setDay] = useState<Date | null>(null);

  const renderContent = () => {
    if (debts.isPending) {
      return <LoadingState />;
    }
    if (debts.isError) {
      return <ErrorState onRetry={onRefresh} />;
    }
    const all = debts.data;
    const byDirection = all.filter((debt) => direction === 'all' || debt.direction === direction);
    const dayKey = day === null ? null : toDueDateString(day);
    const visible = byDirection.filter((debt) => {
      if (dayKey !== null) {
        return debt.due_date === dayKey;
      }
      if (status === 'open') {
        return debt.paid_at === null;
      }
      if (status === 'paid') {
        return debt.paid_at !== null;
      }
      return true;
    });

    return (
      <>
        <View className="flex-row gap-3">
          <TotalCard title={TEXTS.debts.payable} totals={openTotals(all, 'payable')} tone="expense" direction="payable" />
          <TotalCard title={TEXTS.debts.receivable} totals={openTotals(all, 'receivable')} tone="income" direction="receivable" />
        </View>

        <Button title={TEXTS.debts.add} onPress={() => router.push('/debt/new')} className="mt-4" />

        <View className="mt-4">
          <SegmentedControl options={DIRECTION_FILTER} value={direction} onChange={setDirection} />
        </View>

        <View className="mt-4">
          <DebtCalendar debts={byDirection} selected={day} onSelect={setDay} />
          <Text className="mt-2 text-xs text-ink-muted">{TEXTS.debts.calendarHint}</Text>
        </View>

        <View className="mt-4 flex-row flex-wrap items-center gap-2">
          {day !== null ? (
            <>
              <Text className="text-lg font-bold text-ink">{formatDate(day)}</Text>
              <Chip label={TEXTS.debts.showAll} selected={false} onPress={() => setDay(null)} />
            </>
          ) : (
            (
              [
                ['open', TEXTS.debts.filterOpen],
                ['paid', TEXTS.debts.filterPaid],
                ['all', TEXTS.common.all],
              ] as const
            ).map(([value, label]) => (
              <Chip key={value} label={label} selected={status === value} onPress={() => setStatus(value)} />
            ))
          )}
        </View>

        <View className="mt-3">
          {all.length === 0 ? (
            <EmptyState title={TEXTS.debts.emptyTitle} message={TEXTS.debts.emptyMessage} />
          ) : visible.length === 0 ? (
            <Text className="py-6 text-center text-base text-ink-muted">{TEXTS.debts.emptyDay}</Text>
          ) : (
            <Card className="py-1">
              {visible.map((debt, index) => (
                <View key={debt.id} className={index > 0 ? 'border-t border-line' : ''}>
                  <DebtRow debt={debt} />
                </View>
              ))}
            </Card>
          )}
        </View>
      </>
    );
  };

  return (
    <Screen title={TEXTS.debts.title} refreshing={refreshing} onRefresh={onRefresh}>
      {renderContent()}
    </Screen>
  );
}
