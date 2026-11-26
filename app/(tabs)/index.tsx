import { router } from 'expo-router';
import { View } from 'react-native';

import { OwnerOnly } from '@/components/OwnerOnly';
import { BalanceCard } from '@/components/dashboard/BalanceCard';
import { DebtReminder } from '@/components/dashboard/DebtReminder';
import { RecentTransactions } from '@/components/dashboard/RecentTransactions';
import { ReportCard } from '@/components/charts/ReportCard';
import { Screen } from '@/components/Screen';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Button } from '@/components/ui/Button';
import { TEXTS } from '@/constants/texts';
import { useBalances } from '@/hooks/useBalances';
import { useManualRefresh } from '@/hooks/useManualRefresh';
import { useRecentTransactions } from '@/hooks/useTransactions';

const RECENT_LIMIT = 5;

// Asosiy panel: qarz eslatmasi, so'm va dollar balanslari (naqd/karta), oxirgi amallar, hisobot.
export default function DashboardScreenRoute() {
  return (
    <OwnerOnly>
      <DashboardScreen />
    </OwnerOnly>
  );
}

function DashboardScreen() {
  const balances = useBalances();
  const recent = useRecentTransactions(RECENT_LIMIT);
  const { refreshing, onRefresh } = useManualRefresh([balances.refetch, recent.refetch]);

  const renderContent = () => {
    if (balances.isPending || recent.isPending) {
      return <LoadingState />;
    }
    if (balances.isError || recent.isError) {
      return <ErrorState onRetry={onRefresh} />;
    }
    return (
      <>
        <DebtReminder />
        <View className="gap-3">
          <BalanceCard title={TEXTS.dashboard.uzsAccount} currency="UZS" summary={balances.data.UZS} />
          <BalanceCard title={TEXTS.dashboard.usdAccount} currency="USD" summary={balances.data.USD} />
        </View>
        <Button
          title={TEXTS.dashboard.addTransaction}
          onPress={() => router.push('/transaction/new')}
          className="mt-4"
        />
        <RecentTransactions items={recent.data} />
        <ReportCard />
      </>
    );
  };

  return (
    <Screen title={TEXTS.dashboard.title} refreshing={refreshing} onRefresh={onRefresh}>
      {renderContent()}
    </Screen>
  );
}
