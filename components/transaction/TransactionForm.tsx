import { Text, View } from 'react-native';

import { AmountField } from '@/components/transaction/AmountField';
import { CategoryPicker } from '@/components/transaction/CategoryPicker';
import { DateField } from '@/components/transaction/DateField';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { LIMITS } from '@/constants/limits';
import { PAYMENT_METHOD_OPTIONS, TYPE_OPTIONS } from '@/constants/options';
import { TEXTS } from '@/constants/texts';
import { useTransactionForm, type TransactionFormValues } from '@/hooks/useTransactionForm';
import type { TransactionPayload } from '@/types/models';

type TransactionFormProps = {
  initial: TransactionFormValues;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (payload: TransactionPayload) => void;
  onDelete?: () => void;
  deleting?: boolean;
};

// Kirim/chiqim qo'shish va tahrirlash uchun umumiy forma.
export function TransactionForm({
  initial,
  submitting,
  submitError,
  onSubmit,
  onDelete,
  deleting = false,
}: TransactionFormProps) {
  const { values, errors, setField, validate } = useTransactionForm(initial);
  const busy = submitting || deleting;

  const handleSubmit = () => {
    const payload = validate();
    if (payload !== null) {
      onSubmit(payload);
    }
  };

  return (
    <View className="gap-5 pt-2">
      {submitError !== null ? <FormMessage message={submitError} /> : null}

      <SegmentedControl options={TYPE_OPTIONS} value={values.type} onChange={(type) => setField('type', type)} />

      <AmountField
        amountText={values.amountText}
        onChangeAmount={(text) => setField('amountText', text)}
        currency={values.currency}
        onChangeCurrency={(currency) => setField('currency', currency)}
        error={errors.amount}
      />

      <View className="gap-2">
        <Text className="text-sm font-medium text-ink">{TEXTS.transaction.paymentMethodLabel}</Text>
        <SegmentedControl
          options={PAYMENT_METHOD_OPTIONS}
          value={values.paymentMethod}
          onChange={(method) => setField('paymentMethod', method)}
        />
      </View>

      <CategoryPicker
        type={values.type}
        value={values.categoryId}
        onChange={(categoryId) => setField('categoryId', categoryId)}
        error={errors.category}
      />

      <DateField value={values.occurredAt} onChange={(date) => setField('occurredAt', date)} />

      <Input
        label={TEXTS.transaction.noteLabel}
        placeholder={TEXTS.transaction.notePlaceholder}
        value={values.note}
        onChangeText={(note) => setField('note', note)}
        error={errors.note}
        multiline
        maxLength={LIMITS.noteMaxLength}
        textAlignVertical="top"
        className="min-h-[96px] py-3"
      />

      <Button title={TEXTS.common.save} loading={submitting} disabled={busy} onPress={handleSubmit} />
      {onDelete !== undefined ? (
        <Button
          title={TEXTS.transaction.delete}
          variant="danger"
          loading={deleting}
          disabled={busy}
          onPress={onDelete}
        />
      ) : null}
    </View>
  );
}
