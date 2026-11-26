import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { Screen } from '@/components/Screen';
import { EmptyState } from '@/components/states/EmptyState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { TransactionForm } from '@/components/transaction/TransactionForm';
import { TransactionRow } from '@/components/transaction/TransactionRow';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import { TEXTS } from '@/constants/texts';
import { useTransaction } from '@/hooks/useTransactions';
import { useDeleteTransaction, useSaveTransaction } from '@/hooks/useTransactionMutations';
import { toFormValues } from '@/hooks/useTransactionForm';
import { confirmDestructive } from '@/lib/confirm';
import { getDbErrorMessage } from '@/lib/dbErrors';

const EDGES = ['bottom', 'left', 'right'] as const;

export default function EditTransactionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const transaction = useTransaction(id);
  const save = useSaveTransaction();
  const remove = useDeleteTransaction();

  if (transaction.isPending) {
    return (
      <Screen edges={[...EDGES]}>
        <LoadingState />
      </Screen>
    );
  }

  if (transaction.isError) {
    return (
      <Screen edges={[...EDGES]}>
        <ErrorState onRetry={() => void transaction.refetch()} />
      </Screen>
    );
  }

  if (transaction.data === null) {
    return (
      <Screen edges={[...EDGES]}>
        <EmptyState title={TEXTS.transaction.notFoundTitle} message={TEXTS.transaction.notFoundMessage} />
      </Screen>
    );
  }

  // Qarzdan avtomatik yozilgan amal — faqat ko'rish; o'zgartirish qarz sahifasida.
  const debtId = transaction.data.debt_id;
  if (transaction.data.source !== 'manual') {
    return (
      <Screen edges={[...EDGES]}>
        <View className="gap-4 pt-2">
          <Card className="py-1">
            <TransactionRow item={transaction.data} />
          </Card>
          <FormMessage message={TEXTS.transaction.autoNotice} />
          {debtId !== null ? (
            <Button
              title={TEXTS.transaction.openDebt}
              onPress={() => router.replace({ pathname: '/debt/[id]', params: { id: debtId } })}
            />
          ) : null}
        </View>
      </Screen>
    );
  }

  const confirmDelete = () => {
    confirmDestructive({
      title: TEXTS.transaction.deleteConfirmTitle,
      message: TEXTS.transaction.deleteConfirmMessage,
      confirmLabel: TEXTS.common.delete,
      onConfirm: () => remove.mutate(id, { onSuccess: () => router.back() }),
    });
  };

  const failed = save.error ?? remove.error;

  return (
    <Screen edges={[...EDGES]}>
      <TransactionForm
        initial={toFormValues(transaction.data)}
        submitting={save.isPending}
        submitError={failed !== null ? getDbErrorMessage(failed) : null}
        onSubmit={(payload) => save.mutate({ id, payload }, { onSuccess: () => router.back() })}
        onDelete={confirmDelete}
        deleting={remove.isPending}
      />
    </Screen>
  );
}
