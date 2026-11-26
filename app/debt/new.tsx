import { router } from 'expo-router';
import { useState } from 'react';

import { createEmptyDebtValues, DebtForm } from '@/components/debts/DebtForm';
import { Screen } from '@/components/Screen';
import { useSaveDebt } from '@/hooks/useDebts';
import { getDbErrorMessage } from '@/lib/dbErrors';

export default function NewDebtScreen() {
  const save = useSaveDebt();
  const [initial] = useState(() => createEmptyDebtValues());

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <DebtForm
        initial={initial}
        submitting={save.isPending}
        submitError={save.isError ? getDbErrorMessage(save.error) : null}
        onSubmit={(payload) => save.mutate({ payload }, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
