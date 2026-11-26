import { router } from 'expo-router';
import { useState } from 'react';

import { createEmptyEmployeeValues, EmployeeForm } from '@/components/payroll/EmployeeForm';
import { Screen } from '@/components/Screen';
import { useSaveEmployee } from '@/hooks/usePayroll';
import { getDbErrorMessage } from '@/lib/dbErrors';

export default function NewEmployeeScreen() {
  const save = useSaveEmployee();
  const [initial] = useState(createEmptyEmployeeValues);

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <EmployeeForm
        initial={initial}
        isNew
        submitting={save.isPending}
        submitError={save.isError ? getDbErrorMessage(save.error) : null}
        onSubmit={(input) =>
          save.mutate(input, { onSuccess: (id) => router.replace({ pathname: '/employee/[id]', params: { id } }) })
        }
      />
    </Screen>
  );
}
