import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { callPhone, payLabel, ProgressBar, statusLabel } from '@/components/debts/DebtRow';
import { DebtForm, toDebtValues } from '@/components/debts/DebtForm';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import { SIZES } from '@/constants/sizes';
import { TEXTS } from '@/constants/texts';
import { useDebt, useDeleteDebt, useDeleteDebtPayment, useSaveDebt } from '@/hooks/useDebts';
import { confirmDestructive } from '@/lib/confirm';
import { formatDate } from '@/lib/dates';
import { formatPhone } from '@/lib/phone';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { debtProgress } from '@/lib/debts';
import { formatMoney } from '@/lib/format';
import type { DebtPaymentItem, DebtWithPayments } from '@/types/models';

const EDGES = ['bottom', 'left', 'right'] as const;

export default function DebtScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const debt = useDebt(id);

  if (debt.isPending) {
    return (
      <Screen edges={[...EDGES]}>
        <LoadingState />
      </Screen>
    );
  }
  if (debt.isError) {
    return (
      <Screen edges={[...EDGES]}>
        <ErrorState onRetry={() => void debt.refetch()} />
      </Screen>
    );
  }
  if (debt.data === null || debt.data === undefined) {
    return (
      <Screen edges={[...EDGES]}>
        <EmptyState title={TEXTS.debts.notFoundTitle} message={TEXTS.debts.notFoundMessage} />
      </Screen>
    );
  }
  return <DebtDetails debt={debt.data} />;
}

// Qarz sahifasi: qoldiq va to'lovlar, to'lov qo'shish, qo'ng'iroq, tahrirlash, o'chirish.
function DebtDetails({ debt }: { debt: DebtWithPayments }) {
  const save = useSaveDebt();
  const remove = useDeleteDebt();
  const removePayment = useDeleteDebtPayment();
  const progress = debtProgress(debt);
  const isPaid = debt.paid_at !== null;
  const isPayable = debt.direction === 'payable';
  const busy = save.isPending || remove.isPending || removePayment.isPending;
  const failed = save.error ?? remove.error ?? removePayment.error;
  const phone = debt.phone;

  const confirmDelete = () =>
    confirmDestructive({
      title: TEXTS.debts.deleteConfirmTitle,
      message: TEXTS.debts.deleteConfirmMessage,
      confirmLabel: TEXTS.common.delete,
      onConfirm: () => remove.mutate(debt.id, { onSuccess: () => router.back() }),
    });

  const confirmDeletePayment = (payment: DebtPaymentItem) =>
    confirmDestructive({
      title: TEXTS.debts.deletePaymentConfirmTitle,
      message: `${formatMoney(payment.amount, payment.currency)} · ${formatDate(payment.paid_at)}\n${TEXTS.debts.deletePaymentConfirmMessage}`,
      confirmLabel: TEXTS.common.delete,
      onConfirm: () => removePayment.mutate(payment.id),
    });

  return (
    <Screen edges={[...EDGES]}>
      <View className="gap-5 pt-2">
        {failed !== null ? <FormMessage message={getDbErrorMessage(failed)} /> : null}

        <Card className="gap-3">
          <View className="flex-row items-center justify-between gap-3">
            <Text numberOfLines={1} className="flex-1 text-lg font-bold text-ink">
              {debt.counterparty}
            </Text>
            <Text className={`text-sm font-semibold ${isPaid ? 'text-income' : 'text-ink-muted'}`}>
              {statusLabel(debt)}
            </Text>
          </View>
          <View>
            <Text className="text-xs font-medium text-ink-muted">{TEXTS.debts.remainingLabel}</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              className={`text-2xl font-bold ${isPayable ? 'text-expense' : 'text-income'}`}
            >
              {formatMoney(progress.remaining, debt.currency)}
            </Text>
            <Text numberOfLines={1} adjustsFontSizeToFit className="mt-1 text-sm text-ink-muted">
              {TEXTS.debts.paidLabel}: {formatMoney(progress.paid, debt.currency)} /{' '}
              {formatMoney(debt.amount, debt.currency)}
            </Text>
          </View>
          <ProgressBar ratio={progress.ratio} tone={isPayable ? 'expense' : 'income'} />
          {!isPaid ? (
            <Button
              title={payLabel(debt)}
              disabled={busy}
              onPress={() => router.push({ pathname: '/debt/pay/[id]', params: { id: debt.id } })}
            />
          ) : null}
          {phone !== null ? (
            <Button
              title={`${TEXTS.debts.call} · ${formatPhone(phone)}`}
              variant="secondary"
              onPress={() => callPhone(phone)}
            />
          ) : null}
        </Card>

        <View className="gap-2">
          <Text accessibilityRole="header" className="text-lg font-bold text-ink">
            {TEXTS.debts.payments}
          </Text>
          {debt.payments.length === 0 ? (
            <Text className="text-sm text-ink-muted">{TEXTS.debts.noPayments}</Text>
          ) : (
            <Card className="py-1">
              {debt.payments.map((payment, index) => (
                <View
                  key={payment.id}
                  className={`flex-row items-center gap-3 py-3 ${index > 0 ? 'border-t border-line' : ''}`}
                >
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-ink">
                      {formatMoney(payment.amount, payment.currency)}
                    </Text>
                    <Text className="text-sm text-ink-muted">
                      {formatDate(payment.paid_at)} · {TEXTS.paymentMethods[payment.payment_method]}
                      {payment.rate_uzs_per_usd !== null
                        ? ` · 1 $ = ${formatMoney(payment.rate_uzs_per_usd, 'UZS')}`
                        : ''}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={TEXTS.common.delete}
                    hitSlop={SIZES.hitSlop}
                    disabled={busy}
                    onPress={() => confirmDeletePayment(payment)}
                    className="rounded-full bg-danger-soft px-3 py-1.5 active:opacity-70"
                  >
                    <Text className="text-sm font-semibold text-danger">{TEXTS.common.delete}</Text>
                  </Pressable>
                </View>
              ))}
            </Card>
          )}
        </View>

        <DebtForm
          key={debt.updated_at}
          initial={toDebtValues(debt)}
          submitting={save.isPending}
          submitError={null}
          disabled={busy}
          onSubmit={(payload) => save.mutate({ id: debt.id, payload }, { onSuccess: () => router.back() })}
        />

        <Button
          title={TEXTS.debts.delete}
          variant="danger"
          disabled={busy}
          loading={remove.isPending}
          onPress={confirmDelete}
        />
      </View>
    </Screen>
  );
}
