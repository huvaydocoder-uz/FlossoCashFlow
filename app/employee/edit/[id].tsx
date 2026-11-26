import { router, useLocalSearchParams } from 'expo-router';

import { EmployeeForm, toEmployeeValues } from '@/components/payroll/EmployeeForm';
import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { TEXTS } from '@/constants/texts';
import { useEmployee, useSaveEmployee } from '@/hooks/usePayroll';
import { getDbErrorMessage } from '@/lib/dbErrors';

const EDGES = ['bottom', 'left', 'right'] as const;

export default function EditEmployeeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const employee = useEmployee(id);
  const save = useSaveEmployee();

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
        <EmptyState title={TEXTS.orders.notFoundTitle} message={TEXTS.orders.notFoundMessage} />
      </Screen>
    );
  }

  return (
    <Screen edges={[...EDGES]}>
      <EmployeeForm
        key={employee.data.updated_at}
        initial={toEmployeeValues(employee.data)}
        isNew={false}
        submitting={save.isPending}
        submitError={save.isError ? getDbErrorMessage(save.error) : null}
        onSubmit={(input) => save.mutate({ id, ...input }, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
