import { router } from 'expo-router';
import { useState } from 'react';

import { Screen } from '@/components/Screen';
import { TransactionForm } from '@/components/transaction/TransactionForm';
import { useSaveTransaction } from '@/hooks/useTransactionMutations';
import { createEmptyFormValues } from '@/hooks/useTransactionForm';
import { getDbErrorMessage } from '@/lib/dbErrors';

export default function NewTransactionScreen() {
  const save = useSaveTransaction();
  const [initial] = useState(createEmptyFormValues);

  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <TransactionForm
        initial={initial}
        submitting={save.isPending}
        submitError={save.isError ? getDbErrorMessage(save.error) : null}
        onSubmit={(payload) => save.mutate({ payload }, { onSuccess: () => router.back() })}
      />
    </Screen>
  );
}
