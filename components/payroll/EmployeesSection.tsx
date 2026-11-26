import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { MonthSwitcher } from '@/components/payroll/MonthSwitcher';
import { PayrollSummary } from '@/components/payroll/PayrollSummary';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { TEXTS } from '@/constants/texts';
import { usePayroll, useSalaryPayments } from '@/hooks/usePayroll';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { monthKey, monthStart } from '@/lib/months';
import type { CurrencyCode, PayrollRow } from '@/types/database';

function totalsBy(rows: PayrollRow[], key: 'computed' | 'paid' | 'remaining'): Record<CurrencyCode, number> {
  const totals: Record<CurrencyCode, number> = { UZS: 0, USD: 0 };
  for (const row of rows) {
    totals[row.computed_currency] += row[key];
  }
  return totals;
}

const both = (totals: Record<CurrencyCode, number>) =>
  [totals.UZS > 0 ? formatMoney(totals.UZS, 'UZS') : null, totals.USD > 0 ? formatMoney(totals.USD, 'USD') : null]
    .filter((part) => part !== null)
    .join(' + ') || '0';

function EmployeeRow({ row, month }: { row: PayrollRow; month: Date }) {
  const currency = row.computed_currency;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/employee/[id]', params: { id: row.employee_id, month: monthKey(month) } })}
      className="gap-1 py-3 active:opacity-60"
    >
      <View className="flex-row items-center justify-between gap-3">
        <Text numberOfLines={1} className={`flex-1 text-base font-semibold text-ink ${row.active ? '' : 'opacity-50'}`}>
          {row.full_name}
        </Text>
        <Text className={`text-sm font-semibold ${row.remaining > 0 ? 'text-expense' : 'text-income'}`}>
          {formatMoney(row.remaining, currency)}
        </Text>
      </View>
      <Text numberOfLines={1} className="text-sm text-ink-muted">
        {[
          row.position,
          row.pay_type === 'fixed' ? `${row.days_worked}/${row.norm_days} ${TEXTS.payroll.daysLabel.toLowerCase()}` : `${row.percent}% · ${formatMoney(row.sales_usd, 'USD')}`,
          row.active ? null : TEXTS.payroll.archived,
        ]
          .filter((part) => part !== null && part !== '')
          .join(' · ')}
      </Text>
      <Text className="text-xs text-ink-muted">
        {TEXTS.payroll.totalComputed}: {formatMoney(row.computed, currency)} · {TEXTS.payroll.totalPaid}:{' '}
        {formatMoney(row.paid, currency)}
      </Text>
    </Pressable>
  );
}

// Egasi: oy bo'yicha barcha xodimlar — hisoblangan, berilgan, qoldiq.
export function EmployeesSection() {
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const [showArchived, setShowArchived] = useState(false);
  const payroll = usePayroll(month);

  const renderList = () => {
    if (payroll.isPending) {
      return <LoadingState />;
    }
    if (payroll.isError) {
      return <ErrorState onRetry={() => void payroll.refetch()} />;
    }
    const rows = payroll.data.filter((row) => showArchived || row.active);
    if (payroll.data.length === 0) {
      return <EmptyState title={TEXTS.payroll.emptyTitle} message={TEXTS.payroll.emptyMessage} />;
    }
    return (
      <View className="gap-4">
        {/* Jami — arxivdagilar ham (ularga berilmagan oylik ham qarz). */}
        <Card className="gap-1">
          <Text className="text-sm text-ink-muted">
            {TEXTS.payroll.totalComputed}: {both(totalsBy(payroll.data, 'computed'))}
          </Text>
          <Text className="text-sm text-ink-muted">
            {TEXTS.payroll.totalPaid}: {both(totalsBy(payroll.data, 'paid'))}
          </Text>
          <Text className="text-base font-bold text-expense">
            {TEXTS.payroll.totalRemaining}: {both(totalsBy(payroll.data, 'remaining'))}
          </Text>
        </Card>
        <Card className="py-1">
          {rows.map((row, index) => (
            <View key={row.employee_id} className={index > 0 ? 'border-t border-line' : ''}>
              <EmployeeRow row={row} month={month} />
            </View>
          ))}
        </Card>
        {payroll.data.some((row) => !row.active) ? (
          <View className="flex-row">
            <Chip label={TEXTS.payroll.showArchived} selected={showArchived} onPress={() => setShowArchived((v) => !v)} />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View className="gap-4">
      <Button title={TEXTS.payroll.add} onPress={() => router.push('/employee/new')} />
      <MonthSwitcher month={month} onChange={setMonth} />
      {renderList()}
    </View>
  );
}

// Sotuvchi: o'z oyligi — plan bajarilishi va berilganlar (faqat ko'rish).
export function MyPayroll() {
  const [month, setMonth] = useState(() => monthStart(new Date()));
  const payroll = usePayroll(month);
  const row = payroll.data?.[0];

  return (
    <View className="gap-4">
      <MonthSwitcher month={month} onChange={setMonth} />
      {payroll.isPending ? (
        <LoadingState />
      ) : payroll.isError ? (
        <ErrorState onRetry={() => void payroll.refetch()} />
      ) : row === undefined ? (
        <EmptyState title={TEXTS.payroll.myTitle} message={TEXTS.payroll.notLinked} />
      ) : (
        <>
          <PayrollSummary row={row} />
          <PaymentsList employeeId={row.employee_id} month={month} />
        </>
      )}
    </View>
  );
}

export function PaymentsList({
  employeeId,
  month,
  onDelete,
}: {
  employeeId: string;
  month: Date;
  onDelete?: (paymentId: string, label: string) => void;
}) {
  const payments = useSalaryPayments(employeeId, month);
  return (
    <View className="gap-2">
      <Text accessibilityRole="header" className="text-lg font-bold text-ink">
        {TEXTS.payroll.payments}
      </Text>
      {payments.isPending ? (
        <LoadingState />
      ) : payments.isError ? (
        <ErrorState onRetry={() => void payments.refetch()} />
      ) : payments.data.length === 0 ? (
        <Text className="text-sm text-ink-muted">{TEXTS.payroll.noPayments}</Text>
      ) : (
        <Card className="py-1">
          {payments.data.map((payment, index) => {
            const label = `${formatMoney(payment.amount, payment.currency)} · ${formatDate(payment.paid_at)}`;
            return (
              <View key={payment.id} className={`flex-row items-center gap-3 py-3 ${index > 0 ? 'border-t border-line' : ''}`}>
                <View className="flex-1">
                  <Text className="text-base font-semibold text-ink">
                    {formatMoney(payment.amount, payment.currency)} ·{' '}
                    {payment.kind === 'advance' ? TEXTS.payroll.kindAdvance : TEXTS.payroll.kindSalary}
                  </Text>
                  <Text className="text-sm text-ink-muted">
                    {formatDate(payment.paid_at)} · {TEXTS.paymentMethods[payment.payment_method]}
                    {payment.rate_uzs_per_usd !== null ? ` · 1 $ = ${formatMoney(payment.rate_uzs_per_usd, 'UZS')}` : ''}
                  </Text>
                </View>
                {onDelete !== undefined ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => onDelete(payment.id, label)}
                    className="rounded-full bg-danger-soft px-3 py-1.5 active:opacity-70"
                  >
                    <Text className="text-sm font-semibold text-danger">{TEXTS.common.delete}</Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );
}
