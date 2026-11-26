import { router } from 'expo-router';
import { Linking, Pressable, Text, View } from 'react-native';

import { SIZES } from '@/constants/sizes';
import { TEXTS } from '@/constants/texts';
import { formatDate } from '@/lib/dates';
import { daysUntil, debtProgress, getDebtStatus, parseDueDate } from '@/lib/debts';
import { formatMoney } from '@/lib/format';
import { formatPhone, phoneHref } from '@/lib/phone';
import type { Debt } from '@/types/database';
import type { DebtStatus, DebtWithPayments } from '@/types/models';

const BADGE: Record<DebtStatus, { box: string; text: string }> = {
  overdue: { box: 'bg-expense-soft', text: 'text-expense' },
  today: { box: 'bg-warning-soft', text: 'text-warning' },
  upcoming: { box: 'bg-line', text: 'text-ink-muted' },
  paid: { box: 'bg-income-soft', text: 'text-income' },
};

export function statusLabel(debt: Pick<Debt, 'paid_at' | 'due_date'>): string {
  const status = getDebtStatus(debt);
  const days = daysUntil(debt.due_date);
  switch (status) {
    case 'paid':
      return TEXTS.debts.statusPaid;
    case 'today':
      return TEXTS.debts.statusToday;
    case 'overdue':
      return `${Math.abs(days)} ${TEXTS.debts.daysOverdue}`;
    case 'upcoming':
      return `${days} ${TEXTS.debts.daysLeft}`;
  }
}

export function payLabel(debt: Pick<Debt, 'direction'>): string {
  return debt.direction === 'payable' ? TEXTS.debts.payPayable : TEXTS.debts.payReceivable;
}

export function ProgressBar({ ratio, tone }: { ratio: number; tone: 'income' | 'expense' }) {
  return (
    <View className="h-2 overflow-hidden rounded-full bg-line">
      <View
        style={{ width: `${Math.round(ratio * 100)}%` }}
        className={`h-2 rounded-full ${tone === 'income' ? 'bg-income' : 'bg-expense'}`}
      />
    </View>
  );
}

export function callPhone(phone: string): void {
  void Linking.openURL(phoneHref(phone));
}

// Ro'yxatdagi bitta qarz: bosilsa — qarz sahifasi; pastda to'lov va qo'ng'iroq tugmalari.
export function DebtRow({ debt }: { debt: DebtWithPayments }) {
  const status = getDebtStatus(debt);
  const badge = BADGE[status];
  const isPayable = debt.direction === 'payable';
  const progress = debtProgress(debt);
  const phone = debt.phone;
  const subtitle = [
    isPayable ? TEXTS.debts.payable : TEXTS.debts.receivable,
    debt.sector,
    formatDate(parseDueDate(debt.due_date)),
  ]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ');

  return (
    <View className="gap-2 py-3">
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/debt/[id]', params: { id: debt.id } })}
        className="flex-row items-center gap-3 active:opacity-60"
      >
        <View
          className={`h-10 w-10 items-center justify-center rounded-full ${isPayable ? 'bg-expense-soft' : 'bg-income-soft'}`}
        >
          <Text className={`text-lg font-bold ${isPayable ? 'text-expense' : 'text-income'}`}>
            {isPayable ? '↑' : '↓'}
          </Text>
        </View>

        <View className="flex-1">
          <Text
            numberOfLines={1}
            className={`text-base font-medium text-ink ${status === 'paid' ? 'line-through opacity-60' : ''}`}
          >
            {debt.counterparty}
          </Text>
          <Text numberOfLines={1} className="text-sm text-ink-muted">
            {subtitle}
          </Text>
        </View>

        <View className="items-end gap-1">
          <Text className={`text-base font-semibold ${isPayable ? 'text-expense' : 'text-income'}`}>
            {formatMoney(status === 'paid' ? debt.amount : progress.remaining, debt.currency)}
          </Text>
          <View className={`rounded-full px-2 py-0.5 ${badge.box}`}>
            <Text className={`text-xs font-semibold ${badge.text}`}>{statusLabel(debt)}</Text>
          </View>
        </View>
      </Pressable>

      {progress.paid > 0 && status !== 'paid' ? (
        <View className="gap-1 pl-[52px]">
          <ProgressBar ratio={progress.ratio} tone={isPayable ? 'expense' : 'income'} />
          <Text className="text-xs text-ink-muted">
            {TEXTS.debts.paidLabel}: {formatMoney(progress.paid, debt.currency)} /{' '}
            {formatMoney(debt.amount, debt.currency)}
          </Text>
        </View>
      ) : null}

      {status !== 'paid' || phone !== null ? (
        <View className="flex-row flex-wrap gap-2 pl-[52px]">
          {status !== 'paid' ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={SIZES.hitSlop}
              onPress={() => router.push({ pathname: '/debt/pay/[id]', params: { id: debt.id } })}
              className={`rounded-full px-3 py-1.5 active:opacity-70 ${isPayable ? 'bg-expense-soft' : 'bg-income-soft'}`}
            >
              <Text className={`text-sm font-semibold ${isPayable ? 'text-expense' : 'text-income'}`}>
                {payLabel(debt)}
              </Text>
            </Pressable>
          ) : null}
          {phone !== null ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${TEXTS.debts.call}: ${formatPhone(phone)}`}
              hitSlop={SIZES.hitSlop}
              onPress={() => callPhone(phone)}
              className="rounded-full bg-primary-soft px-3 py-1.5 active:opacity-70"
            >
              <Text className="text-sm font-semibold text-primary">
                {TEXTS.debts.call} · {formatPhone(phone)}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
