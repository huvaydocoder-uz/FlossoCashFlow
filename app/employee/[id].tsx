import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { callPhone } from '@/components/debts/DebtRow';
import { PaymentsList } from '@/components/payroll/EmployeesSection';
import { MonthSwitcher } from '@/components/payroll/MonthSwitcher';
import { PayrollSummary } from '@/components/payroll/PayrollSummary';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { TEXTS } from '@/constants/texts';
import { useAccess } from '@/hooks/useMembership';
import {
  useDeleteEmployee,
  useDeleteSalaryPayment,
  useEmployee,
  usePayroll,
  useSetDaysWorked,
  useSetEmployeeActive,
} from '@/hooks/usePayroll';
import { confirmDestructive } from '@/lib/confirm';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { parseDueDate } from '@/lib/debts';
import { monthKey, monthStart } from '@/lib/months';
import { formatPhone } from '@/lib/phone';

const EDGES = ['bottom', 'left', 'right'] as const;

export default function EmployeeScreen() {
  const params = useLocalSearchParams<{ id: string; month?: string }>();
  const id = params.id;
  const [month, setMonth] = useState(() =>
    params.month !== undefined && /^\d{4}-\d{2}-01$/.test(params.month) ? parseDueDate(params.month) : monthStart(new Date()),
  );
  const isOwner = useAccess() === 'owner';
  const employee = useEmployee(id);
  const payroll = usePayroll(month);
  const setDays = useSetDaysWorked();
  const setActive = useSetEmployeeActive();
  const remove = useDeleteEmployee();
  const removePayment = useDeleteSalaryPayment();
  const row = payroll.data?.find((item) => item.employee_id === id);
  const [daysText, setDaysText] = useState('');
  const [daysError, setDaysError] = useState<string>();
  const failed = setDays.error ?? setActive.error ?? remove.error ?? removePayment.error;

  useEffect(() => {
    setDaysText(row === undefined ? '' : String(row.days_worked));
  }, [row?.days_worked, row?.employee_id, monthKey(month)]);

  if (employee.isPending) {
    return (
      <Screen edges={[...EDGES]}>
        <LoadingState />
      </Screen>
    );
  }
  if (employee.isError) {
    return (
      <Screen edges={[...EDGES]}>
        <ErrorState onRetry={() => void employee.refetch()} />
      </Screen>
    );
  }
  if (employee.data === null) {
    return (
      <Screen edges={[...EDGES]}>
        <EmptyState title={TEXTS.payroll.emptyTitle} message={TEXTS.orders.notFoundMessage} />
      </Screen>
    );
  }
  const data = employee.data;
  const phone = data.phone;

  const saveDays = () => {
    const days = Number(daysText);
    if (daysText.trim() === '' || !Number.isInteger(days) || days < 0 || days > 31) {
      setDaysError(TEXTS.payroll.daysInvalid);
      return;
    }
    setDaysError(undefined);
    setDays.mutate({ employeeId: id, month, days });
  };

  return (
    <Screen edges={[...EDGES]}>
      <View className="gap-4 pt-2">
        {failed !== null ? <FormMessage message={getDbErrorMessage(failed)} /> : null}

        <Card className="gap-1">
          <Text className="text-xl font-bold text-ink">{data.full_name}</Text>
          <Text className="text-sm text-ink-muted">
            {[data.position, data.pay_type === 'fixed' ? TEXTS.payroll.payFixed : TEXTS.payroll.payCommission, data.deleted_at !== null ? TEXTS.payroll.deletedBadge : data.active ? null : TEXTS.payroll.archived]
              .filter((part) => part !== null && part !== '')
              .join(' · ')}
          </Text>
          {phone !== null ? (
            <Button title={`${TEXTS.orders.call} · ${formatPhone(phone)}`} variant="secondary" onPress={() => callPhone(phone)} className="mt-3" />
          ) : null}
        </Card>

        <MonthSwitcher month={month} onChange={setMonth} />

        {payroll.isPending ? (
          <LoadingState />
        ) : payroll.isError ? (
          <ErrorState onRetry={() => void payroll.refetch()} />
        ) : row === undefined ? null : (
          <>
            {data.pay_type === 'fixed' && isOwner ? (
              <Card className="gap-3">
                <Input
                  label={TEXTS.payroll.daysLabel}
                  value={daysText}
                  onChangeText={(text) => {
                    setDaysText(text.replace(/\D/g, '').slice(0, 2));
                    setDaysError(undefined);
                  }}
                  error={daysError}
                  keyboardType="number-pad"
                />
                <Button title={TEXTS.payroll.saveDays} variant="secondary" loading={setDays.isPending} onPress={saveDays} />
              </Card>
            ) : null}
            <PayrollSummary row={row} />
            {isOwner ? (
              <Button
                title={TEXTS.payroll.addPayment}
                onPress={() => router.push({ pathname: '/employee/pay/[id]', params: { id, month: monthKey(month) } })}
              />
            ) : null}
          </>
        )}

        <PaymentsList
          employeeId={id}
          month={month}
          onDelete={
            isOwner
              ? (paymentId, label) =>
                  confirmDestructive({
                    title: TEXTS.payroll.deletePaymentConfirmTitle,
                    message: `${label}\n${TEXTS.payroll.deletePaymentConfirmMessage}`,
                    confirmLabel: TEXTS.common.delete,
                    onConfirm: () => removePayment.mutate(paymentId),
                  })
              : undefined
          }
        />

        {isOwner && data.deleted_at === null ? (
          <View className="gap-3">
            <Button
              title={TEXTS.orders.edit}
              variant="secondary"
              onPress={() => router.push({ pathname: '/employee/edit/[id]', params: { id } })}
            />
            <Button
              title={data.active ? TEXTS.payroll.archive : TEXTS.payroll.unarchive}
              variant="ghost"
              loading={setActive.isPending}
              onPress={() => setActive.mutate({ id, active: !data.active })}
            />
            <Button
              title={TEXTS.payroll.delete}
              variant="danger"
              loading={remove.isPending}
              onPress={() =>
                confirmDestructive({
                  title: TEXTS.payroll.deleteConfirmTitle,
                  message: TEXTS.payroll.deleteConfirmMessage,
                  confirmLabel: TEXTS.common.delete,
                  onConfirm: () => remove.mutate(id, { onSuccess: () => router.back() }),
                })
              }
            />
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
