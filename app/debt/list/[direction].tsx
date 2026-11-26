import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { DebtRow } from '@/components/debts/DebtRow';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { TEXTS } from '@/constants/texts';
import { useDebts } from '@/hooks/useDebts';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { debtProgress } from '@/lib/debts';
import { formatMoney } from '@/lib/format';
import type { CurrencyCode, DebtDirection } from '@/types/database';

const EDGES = ['bottom', 'left', 'right'] as const;

// Jami kartadan ochiladi: bitta turdagi qarzlar — har birini bosib tahrirlash, to'lash, qo'ng'iroq qilish.
export default function DebtListScreen() {
  const params = useLocalSearchParams<{ direction: string }>();
  const direction: DebtDirection = params.direction === 'receivable' ? 'receivable' : 'payable';
  const debts = useDebts();
  const { refreshing, onRefresh } = useManualRefresh([debts.refetch]);
  const [showPaid, setShowPaid] = useState(false);
  const title = direction === 'payable' ? TEXTS.debts.payable : TEXTS.debts.receivable;

  const renderContent = () => {
    if (debts.isPending) {
      return <LoadingState />;
    }
    if (debts.isError) {
      return <ErrorState onRetry={onRefresh} />;
    }
    const ofType = debts.data.filter((debt) => debt.direction === direction);
    const visible = ofType.filter((debt) => showPaid || debt.paid_at === null);
    const totals: Record<CurrencyCode, number> = { UZS: 0, USD: 0 };
    for (const debt of ofType) {
      if (debt.paid_at === null) {
        totals[debt.currency] += debtProgress(debt).remaining;
      }
    }
    const color = direction === 'payable' ? 'text-expense' : 'text-income';

    return (
      <View className="gap-4">
        <Card className="gap-1">
          <Text className="text-sm font-medium text-ink-muted">{TEXTS.debts.openTotal}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit className={`text-2xl font-bold ${color}`}>
            {formatMoney(totals.UZS, 'UZS')}
          </Text>
          <Text numberOfLines={1} adjustsFontSizeToFit className={`text-lg font-semibold ${color}`}>
            {formatMoney(totals.USD, 'USD')}
          </Text>
        </Card>
        <View className="flex-row">
          <Chip label={TEXTS.debts.listPaid} selected={showPaid} onPress={() => setShowPaid((value) => !value)} />
        </View>
        {visible.length === 0 ? (
          <EmptyState title={TEXTS.debts.emptyTitle} message={TEXTS.debts.emptyMessage} />
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
    );
  };

  return (
    <Screen edges={[...EDGES]} refreshing={refreshing} onRefresh={onRefresh}>
      <Stack.Screen options={{ title }} />
      {renderContent()}
    </Screen>
  );
}
