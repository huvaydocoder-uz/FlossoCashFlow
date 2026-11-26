import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { DateField } from '@/components/transaction/DateField';
import { payLabel } from '@/components/debts/DebtRow';
import { CURRENCY_OPTIONS, PAYMENT_METHOD_OPTIONS } from '@/constants/options';
import { TEXTS } from '@/constants/texts';
import { useAddDebtPayment, useDebt } from '@/hooks/useDebts';
import { useUsdRate } from '@/hooks/useOrders';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { debtProgress, exceedsRemaining, payInCurrency } from '@/lib/debts';
import { formatAmountInput, formatMoney, parseAmountInput } from '@/lib/format';
import { toOrderCurrency } from '@/lib/orders';
import type { CurrencyCode, PaymentMethod } from '@/types/database';
import type { DebtWithPayments } from '@/types/models';

const EDGES = ['bottom', 'left', 'right'] as const;
const toInput = (value: number) => formatAmountInput(String(value).replace('.', ','));

// "Qarzimni berdim" / "Qarzini berdi": summa (standart — qoldiq), naqd/karta, sana.
export default function PayDebtScreen() {
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
  return <PayForm debt={debt.data} />;
}

function PayForm({ debt }: { debt: DebtWithPayments }) {
  const pay = useAddDebtPayment();
  const remaining = debtProgress(debt).remaining;
  const [paidAt, setPaidAt] = useState(() => new Date());
  const rate = useUsdRate(paidAt);
  const [currency, setCurrency] = useState<CurrencyCode>(debt.currency);
  const [amountText, setAmountText] = useState(() => toInput(remaining));
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [rateText, setRateText] = useState('');
  const [rateTouched, setRateTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [error, setError] = useState<string>();
  const foreign = currency !== debt.currency;

  // Markaziy bank kursi; qo'lda tuzatilgan kurs ustidan yozilmaydi.
  useEffect(() => {
    if (typeof rate.data === 'number' && !rateTouched) {
      setRateText(toInput(rate.data));
    }
  }, [rate.data, rateTouched]);

  const amount = parseAmountInput(amountText);
  const rateValue = parseAmountInput(rateText);
  const validRate = rateValue !== null && rateValue >= 5000 && rateValue <= 50000 ? rateValue : null;

  // Valyuta almashganda yoki kurs kelganda summani qayta hisoblaymiz (foydalanuvchi o'zi yozmagan bo'lsa).
  useEffect(() => {
    if (amountTouched) {
      return;
    }
    if (!foreign) {
      setAmountText(toInput(remaining));
    } else if (validRate !== null) {
      setAmountText(toInput(payInCurrency(remaining, debt.currency, currency, validRate)));
    } else {
      setAmountText('');
    }
  }, [amountTouched, foreign, validRate, remaining, debt.currency, currency]);
  const converted =
    amount === null ? null : foreign ? (rateValue !== null && rateValue > 0 ? toOrderCurrency(amount, currency, debt.currency, rateValue) : null) : amount;

  const changeCurrency = (next: CurrencyCode) => {
    setCurrency(next);
    setError(undefined);
    setAmountTouched(false);
  };

  const submit = () => {
    if (amountText.trim().length === 0) {
      setError(TEXTS.validation.amountRequired);
      return;
    }
    if (amount === null || amount <= 0) {
      setError(TEXTS.validation.amountInvalid);
      return;
    }
    if (foreign && (rateValue === null || rateValue < 5000 || rateValue > 50000)) {
      setError(TEXTS.dbErrors.rateUnrealistic);
      return;
    }
    if (exceedsRemaining(amount, currency, debt.currency, foreign ? rateValue : null, remaining)) {
      setError(TEXTS.dbErrors.overpay);
      return;
    }
    pay.mutate(
      { debtId: debt.id, amount, method, paidAt, currency, rate: foreign ? rateValue : null },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen edges={[...EDGES]}>
      <View className="gap-5 pt-2">
        <Card className="gap-1">
          <Text className="text-lg font-semibold text-ink">{debt.counterparty}</Text>
          <Text className="text-sm text-ink-muted">
            {TEXTS.debts.remainingLabel}: {formatMoney(remaining, debt.currency)}
          </Text>
        </Card>

        {pay.isError ? <FormMessage message={getDbErrorMessage(pay.error)} /> : null}

        <View className="gap-2">
          <Text className="text-sm font-medium text-ink">{TEXTS.debts.payCurrencyLabel}</Text>
          <SegmentedControl options={CURRENCY_OPTIONS} value={currency} onChange={changeCurrency} />
        </View>

        <Input
          label={`${TEXTS.debts.payAmountLabel} (${TEXTS.currencies[currency]})`}
          value={amountText}
          onChangeText={(text) => {
            setAmountText(formatAmountInput(text));
            setAmountTouched(true);
            setError(undefined);
          }}
          error={error}
          keyboardType="decimal-pad"
          className="text-[22px] font-semibold"
        />

        <View className="gap-2">
          <Text className="text-sm font-medium text-ink">{TEXTS.debts.payWith}</Text>
          <SegmentedControl options={PAYMENT_METHOD_OPTIONS} value={method} onChange={setMethod} />
        </View>

        {foreign ? (
          <View className="gap-1">
            <Input
              label={TEXTS.orders.rateLabel}
              value={rateText}
              onChangeText={(text) => {
                setRateText(formatAmountInput(text));
                setRateTouched(true);
              }}
              keyboardType="decimal-pad"
            />
            <Text className="text-sm text-ink-muted">
              {rate.data === null ? TEXTS.orders.rateManual : TEXTS.orders.rateHint}
              {converted !== null
                ? ` · ${TEXTS.debts.inDebtCurrency}: ${formatMoney(Math.round(converted * 100) / 100, debt.currency)}`
                : ''}
            </Text>
          </View>
        ) : null}

        <DateField label={TEXTS.debts.payDateLabel} value={paidAt} onChange={setPaidAt} />

        <Button title={payLabel(debt)} loading={pay.isPending} onPress={submit} />
      </View>
    </Screen>
  );
}
