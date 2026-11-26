import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { DateField } from '@/components/transaction/DateField';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { CURRENCY_OPTIONS, PAYMENT_METHOD_OPTIONS } from '@/constants/options';
import { TEXTS } from '@/constants/texts';
import { useAddOrderPayment, useOrder, useUsdRate } from '@/hooks/useOrders';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { formatAmountInput, formatMoney, parseAmountInput } from '@/lib/format';
import { formatOrderNumber, toOrderCurrency } from '@/lib/orders';
import type { CurrencyCode, PaymentMethod } from '@/types/database';
import type { OrderDetail } from '@/types/models';

const EDGES = ['bottom', 'left', 'right'] as const;
const toInput = (value: number) => formatAmountInput(String(value).replace('.', ','));

// Mijoz to'lovi: naqd/karta, so'm/$; kurs — Markaziy bankdan (o'zgartirish mumkin).
export default function OrderPaymentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const order = useOrder(id);

  if (order.isPending) {
    return (
      <Screen edges={[...EDGES]}>
        <LoadingState />
      </Screen>
    );
  }
  if (order.isError) {
    return (
      <Screen edges={[...EDGES]}>
        <ErrorState onRetry={() => void order.refetch()} />
      </Screen>
    );
  }
  if (order.data === null || !order.data.can_see_money || order.data.currency === null) {
    return (
      <Screen edges={[...EDGES]}>
        <EmptyState title={TEXTS.orders.notFoundTitle} message={TEXTS.orders.notFoundMessage} />
      </Screen>
    );
  }
  return <PaymentForm order={order.data} orderCurrency={order.data.currency} />;
}

function PaymentForm({ order, orderCurrency }: { order: OrderDetail; orderCurrency: CurrencyCode }) {
  const pay = useAddOrderPayment();
  const [paidAt, setPaidAt] = useState(() => new Date());
  const rate = useUsdRate(paidAt);
  const remaining = order.remaining ?? 0;
  const [currency, setCurrency] = useState<CurrencyCode>(orderCurrency);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [amountText, setAmountText] = useState(() => (remaining > 0 ? toInput(remaining) : ''));
  const [rateText, setRateText] = useState('');
  const [rateTouched, setRateTouched] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    // Qo'lda tuzatilgan kurs ustidan yozilmaydi.
    if (typeof rate.data === 'number' && !rateTouched) {
      setRateText(toInput(rate.data));
    }
  }, [rate.data, rateTouched]);

  const amount = parseAmountInput(amountText);
  const rateValue = parseAmountInput(rateText);
  const converted =
    amount !== null && rateValue !== null && rateValue > 0 ? toOrderCurrency(amount, currency, orderCurrency, rateValue) : null;

  const changeCurrency = (next: CurrencyCode) => {
    setCurrency(next);
    setError(undefined);
    if (rateValue !== null && rateValue > 0 && remaining > 0) {
      setAmountText(toInput(Math.round(toOrderCurrency(remaining, orderCurrency, next, rateValue) * 100) / 100));
    }
  };

  const submit = () => {
    if (amount === null || amount <= 0) {
      setError(amountText.trim() === '' ? TEXTS.validation.amountRequired : TEXTS.validation.amountInvalid);
      return;
    }
    if (rateValue === null || rateValue <= 0) {
      setError(TEXTS.orders.rateRequired);
      return;
    }
    if (converted !== null && converted > remaining + 0.005) {
      setError(TEXTS.dbErrors.orderOverpay);
      return;
    }
    pay.mutate(
      { orderId: order.id, amount, currency, method, rate: rateValue, paidAt, isAdvance: order.payments.length === 0 },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen edges={[...EDGES]}>
      <View className="gap-5 pt-2">
        <Card className="gap-1">
          <Text className="text-lg font-semibold text-ink">
            {formatOrderNumber(order.number)} · {order.customer_name}
          </Text>
          <Text className="text-sm text-ink-muted">
            {TEXTS.orders.remainingLabel}: {formatMoney(remaining, orderCurrency)}
          </Text>
        </Card>

        {pay.isError ? <FormMessage message={getDbErrorMessage(pay.error)} /> : null}

        <SegmentedControl options={CURRENCY_OPTIONS} value={currency} onChange={changeCurrency} />
        <Input
          label={TEXTS.debts.payAmountLabel}
          value={amountText}
          onChangeText={(text) => {
            setAmountText(formatAmountInput(text));
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
          {converted !== null && currency !== orderCurrency
            ? ` · ${TEXTS.orders.inOrderCurrency}: ${formatMoney(Math.round(converted * 100) / 100, orderCurrency)}`
            : ''}
        </Text>
        <DateField label={TEXTS.debts.payDateLabel} value={paidAt} onChange={setPaidAt} />
        <Button title={TEXTS.common.save} loading={pay.isPending} onPress={submit} />
      </View>
    </Screen>
  );
}
