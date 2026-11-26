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
import { useUsdRate } from '@/hooks/useOrders';
import { useAddSalaryPayment, usePayroll } from '@/hooks/usePayroll';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { parseDueDate, payInCurrency } from '@/lib/debts';
import { formatAmountInput, formatMoney, parseAmountInput } from '@/lib/format';
import { formatMonth, monthStart } from '@/lib/months';
import { toOrderCurrency } from '@/lib/orders';
import type { CurrencyCode, PaymentMethod, PayrollRow, SalaryPaymentKind } from '@/types/database';

const EDGES = ['bottom', 'left', 'right'] as const;
const toInput = (value: number) => (value > 0 ? formatAmountInput(String(value).replace('.', ',')) : '');

export default function SalaryPaymentScreen() {
  const params = useLocalSearchParams<{ id: string; month?: string }>();
  const month =
    params.month !== undefined && /^\d{4}-\d{2}-01$/.test(params.month) ? parseDueDate(params.month) : monthStart(new Date());
  const payroll = usePayroll(month);
  const row = payroll.data?.find((item) => item.employee_id === params.id);

  if (payroll.isPending) {
    return (
      <Screen edges={[...EDGES]}>
        <LoadingState />
      </Screen>
    );
  }
  if (payroll.isError) {
    return (
      <Screen edges={[...EDGES]}>
        <ErrorState onRetry={() => void payroll.refetch()} />
      </Screen>
    );
  }
  if (row === undefined) {
    return (
      <Screen edges={[...EDGES]}>
        <EmptyState title={TEXTS.payroll.emptyTitle} message={TEXTS.orders.notFoundMessage} />
      </Screen>
    );
  }
  return <PayForm row={row} month={month} />;
}

// Avans yoki oylik: summa (standart — qoldiq), so'm/$, naqd/karta, sana. Kassaga "Oylik" chiqimi.
function PayForm({ row, month }: { row: PayrollRow; month: Date }) {
  const pay = useAddSalaryPayment();
  const salaryCurrency = row.computed_currency;
  const [paidAt, setPaidAt] = useState(() => new Date());
  const rate = useUsdRate(paidAt);
  const [currency, setCurrency] = useState<CurrencyCode>(salaryCurrency);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [kind, setKind] = useState<SalaryPaymentKind>(row.paid === 0 && row.remaining > 0 ? 'advance' : 'salary');
  const [amountText, setAmountText] = useState(() => toInput(row.remaining));
  const [amountTouched, setAmountTouched] = useState(false);
  const [rateText, setRateText] = useState('');
  const [rateTouched, setRateTouched] = useState(false);
  const [error, setError] = useState<string>();
  const foreign = currency !== salaryCurrency;
  const rateValue = parseAmountInput(rateText);
  const validRate = rateValue !== null && rateValue >= 5000 && rateValue <= 50000 ? rateValue : null;
  const amount = parseAmountInput(amountText);

  useEffect(() => {
    if (typeof rate.data === 'number' && !rateTouched) {
      setRateText(formatAmountInput(String(rate.data).replace('.', ',')));
    }
  }, [rate.data, rateTouched]);

  // Valyuta almashsa yoki kurs kelsa — qoldiq tanlangan valyutada (foydalanuvchi o'zi yozmagan bo'lsa).
  useEffect(() => {
    if (amountTouched) {
      return;
    }
    if (!foreign) {
      setAmountText(toInput(row.remaining));
    } else if (validRate !== null) {
      setAmountText(toInput(payInCurrency(row.remaining, salaryCurrency, currency, validRate)));
    } else {
      setAmountText('');
    }
  }, [amountTouched, foreign, validRate, row.remaining, salaryCurrency, currency]);

  const submit = () => {
    if (amount === null || amount <= 0) {
      setError(amountText.trim() === '' ? TEXTS.validation.amountRequired : TEXTS.validation.amountInvalid);
      return;
    }
    if (foreign && validRate === null) {
      setError(TEXTS.dbErrors.rateUnrealistic);
      return;
    }
    pay.mutate(
      { employeeId: row.employee_id, month, amount, currency, method, rate: foreign ? validRate : null, kind, paidAt },
      { onSuccess: () => router.back() },
    );
  };

  return (
    <Screen edges={[...EDGES]}>
      <View className="gap-5 pt-2">
        <Card className="gap-1">
          <Text className="text-lg font-semibold text-ink">
            {row.full_name} · {formatMonth(month)}
          </Text>
          <Text className="text-sm text-ink-muted">
            {TEXTS.payroll.totalRemaining}: {formatMoney(row.remaining, salaryCurrency)}
          </Text>
        </Card>

        {pay.isError ? <FormMessage message={getDbErrorMessage(pay.error)} /> : null}

        <View className="gap-2">
          <Text className="text-sm font-medium text-ink">{TEXTS.payroll.kindLabel}</Text>
          <SegmentedControl
            options={[
              { value: 'advance', label: TEXTS.payroll.kindAdvance },
              { value: 'salary', label: TEXTS.payroll.kindSalary },
            ]}
            value={kind}
            onChange={setKind}
          />
        </View>

        <SegmentedControl
          options={CURRENCY_OPTIONS}
          value={currency}
          onChange={(next) => {
            setCurrency(next);
            setAmountTouched(false);
            setError(undefined);
          }}
        />
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
              {amount !== null && validRate !== null
                ? ` · ${formatMoney(Math.round(toOrderCurrency(amount, currency, salaryCurrency, validRate) * 100) / 100, salaryCurrency)}`
                : ''}
            </Text>
          </View>
        ) : null}
        <DateField label={TEXTS.debts.payDateLabel} value={paidAt} onChange={setPaidAt} />
        <Button title={TEXTS.common.save} loading={pay.isPending} onPress={submit} />
      </View>
    </Screen>
  );
}
