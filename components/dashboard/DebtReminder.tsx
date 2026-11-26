import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { statusLabel } from '@/components/debts/DebtRow';
import { TEXTS } from '@/constants/texts';
import { useDebts } from '@/hooks/useDebts';
import { debtProgress, groupReminders } from '@/lib/debts';
import { formatMoney } from '@/lib/format';
import type { DebtWithPayments } from '@/types/models';

const MAX_PER_GROUP = 3;

// Bitta qarz qatori: turi (kompaniya / mijoz), kim, qoldiq va muddat. Bosilsa — shu qarz ochiladi.
function ReminderItem({ debt }: { debt: DebtWithPayments }) {
  const payable = debt.direction === 'payable';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${payable ? TEXTS.dashboard.debtReminderPayable : TEXTS.dashboard.debtReminderReceivable}: ${debt.counterparty}`}
      onPress={() => router.push({ pathname: '/debt/[id]', params: { id: debt.id } })}
      className="flex-row items-center gap-3 rounded-control bg-surface px-3 py-2.5 active:opacity-70"
    >
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <View className={`rounded-full px-2 py-0.5 ${payable ? 'bg-expense-soft' : 'bg-income-soft'}`}>
            <Text className={`text-xs font-semibold ${payable ? 'text-expense' : 'text-income'}`}>
              {payable ? '↑' : '↓'} {payable ? TEXTS.dashboard.debtReminderPayable : TEXTS.dashboard.debtReminderReceivable}
            </Text>
          </View>
          <Text className="text-xs text-ink-muted">{statusLabel(debt)}</Text>
        </View>
        <Text numberOfLines={1} className="text-base font-semibold text-ink">
          {debt.counterparty}
        </Text>
        <Text className="text-xs text-ink-muted">
          {payable ? TEXTS.debts.payableHint : TEXTS.debts.receivableHint}
        </Text>
      </View>
      <Text className={`text-base font-bold ${payable ? 'text-expense' : 'text-income'}`}>
        {formatMoney(debtProgress(debt).remaining, debt.currency)}
      </Text>
      <Text className="text-lg text-ink-muted">›</Text>
    </Pressable>
  );
}

function Group({ title, debts, tone }: { title: string; debts: DebtWithPayments[]; tone: string }) {
  if (debts.length === 0) {
    return null;
  }
  const hidden = debts.length - MAX_PER_GROUP;
  return (
    <View className="gap-2">
      <Text className={`text-sm font-semibold ${tone}`}>
        {title}: {debts.length}
      </Text>
      {debts.slice(0, MAX_PER_GROUP).map((debt) => (
        <ReminderItem key={debt.id} debt={debt} />
      ))}
      {hidden > 0 ? (
        <Text className="text-xs text-ink-muted">
          +{hidden} {TEXTS.dashboard.debtReminderMore}
        </Text>
      ) : null}
    </View>
  );
}

// Asosiy sahifadagi eslatma: muddati o'tgan, bugungi va yaqin kunlardagi qarzlar.
export function DebtReminder() {
  const debts = useDebts();
  if (debts.data === undefined) {
    return null;
  }
  const groups = groupReminders(debts.data);
  if (groups.overdue.length + groups.today.length + groups.soon.length === 0) {
    return null;
  }
  const urgent = groups.overdue.length > 0;

  return (
    <View
      className={`mb-4 gap-3 rounded-card border p-4 ${urgent ? 'border-expense bg-expense-soft' : 'border-warning bg-warning-soft'}`}
    >
      <Group title={TEXTS.dashboard.debtReminderOverdue} debts={groups.overdue} tone="text-expense" />
      <Group title={TEXTS.dashboard.debtReminderToday} debts={groups.today} tone="text-warning" />
      <Group title={TEXTS.dashboard.debtReminderSoon} debts={groups.soon} tone="text-ink-muted" />
      <Pressable
        accessibilityRole="link"
        onPress={() => router.navigate('/debts')}
        className="self-start py-1 active:opacity-70"
      >
        <Text className="text-sm font-semibold text-primary">{TEXTS.dashboard.debtReminderOpen} ›</Text>
      </Pressable>
    </View>
  );
}
