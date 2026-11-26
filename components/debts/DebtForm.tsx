import { useState } from 'react';
import { Text, View } from 'react-native';

import { AmountField } from '@/components/transaction/AmountField';
import { DateField } from '@/components/transaction/DateField';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { LIMITS } from '@/constants/limits';
import { DEBT_DIRECTION_OPTIONS, DEBT_ORIGIN_OPTIONS, type DebtOrigin } from '@/constants/options';
import { TEXTS } from '@/constants/texts';
import { addDays } from '@/lib/dates';
import { parseDueDate, toDueDateString } from '@/lib/debts';
import { formatAmountInput, parseAmountInput } from '@/lib/format';
import { formatPhone, normalizePhone } from '@/lib/phone';
import { hasErrors, validateCounterparty, validateNote, validatePhone, validateSector } from '@/lib/validation';
import type { CurrencyCode, Debt, DebtDirection } from '@/types/database';
import type { DebtPayload } from '@/types/models';

export type DebtFormValues = {
  direction: DebtDirection;
  counterparty: string;
  amountText: string;
  currency: CurrencyCode;
  dueDate: Date;
  note: string;
  phone: string;
  sector: string;
  origin: DebtOrigin;
};

type FormErrors = Partial<Record<'counterparty' | 'amount' | 'note' | 'phone' | 'sector', string>>;

export function createEmptyDebtValues(direction: DebtDirection = 'receivable'): DebtFormValues {
  return {
    direction,
    counterparty: '',
    amountText: '',
    currency: 'UZS',
    dueDate: addDays(new Date(), 7),
    note: '',
    phone: '',
    sector: '',
    origin: 'credit',
  };
}

export function toDebtValues(debt: Debt): DebtFormValues {
  return {
    direction: debt.direction,
    counterparty: debt.counterparty,
    amountText: formatAmountInput(String(debt.amount).replace('.', ',')),
    currency: debt.currency,
    dueDate: parseDueDate(debt.due_date),
    note: debt.note ?? '',
    phone: debt.phone === null ? '' : formatPhone(debt.phone),
    sector: debt.sector ?? '',
    origin: debt.origin_method ?? 'credit',
  };
}

type DebtFormProps = {
  initial: DebtFormValues;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (payload: DebtPayload) => void;
  disabled?: boolean;
};

// Qarz qo'shish va tahrirlash formasi.
export function DebtForm({ initial, submitting, submitError, onSubmit, disabled = false }: DebtFormProps) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FormErrors>({});

  const set = <K extends keyof DebtFormValues>(key: K, value: DebtFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
    if (key === 'counterparty' || key === 'note' || key === 'phone' || key === 'sector') {
      setErrors((current) => ({ ...current, [key]: undefined }));
    }
    if (key === 'amountText') {
      setErrors((current) => ({ ...current, amount: undefined }));
    }
  };

  const handleSubmit = () => {
    const amount = parseAmountInput(values.amountText);
    const nextErrors: FormErrors = {
      counterparty: validateCounterparty(values.counterparty),
      amount:
        values.amountText.trim().length === 0
          ? TEXTS.validation.amountRequired
          : amount === null || amount <= 0
            ? TEXTS.validation.amountInvalid
            : undefined,
      note: validateNote(values.note),
      phone: validatePhone(values.phone),
      sector: validateSector(values.sector),
    };
    setErrors(nextErrors);
    if (hasErrors(nextErrors) || amount === null) {
      return;
    }
    const note = values.note.trim();
    const phone = normalizePhone(values.phone);
    const sector = values.sector.trim();
    onSubmit({
      direction: values.direction,
      counterparty: values.counterparty.trim(),
      amount,
      currency: values.currency,
      due_date: toDueDateString(values.dueDate),
      note: note.length > 0 ? note : null,
      phone,
      sector: sector.length > 0 ? sector : null,
      origin_method: values.origin === 'credit' ? null : values.origin,
    });
  };

  return (
    <View className="gap-5">
      {submitError !== null ? <FormMessage message={submitError} /> : null}

      <View className="gap-2">
        <Text className="text-sm font-medium text-ink">{TEXTS.debts.directionLabel}</Text>
        <SegmentedControl
          options={DEBT_DIRECTION_OPTIONS}
          value={values.direction}
          onChange={(direction) => set('direction', direction)}
        />
        <Text className="text-sm text-ink-muted">
          {values.direction === 'payable' ? TEXTS.debts.payableHint : TEXTS.debts.receivableHint}
        </Text>
      </View>

      <Input
        label={
          values.direction === 'payable'
            ? TEXTS.debts.counterpartyPayableLabel
            : TEXTS.debts.counterpartyReceivableLabel
        }
        placeholder={TEXTS.debts.counterpartyPlaceholder}
        value={values.counterparty}
        onChangeText={(text) => set('counterparty', text)}
        error={errors.counterparty}
        maxLength={LIMITS.counterpartyMaxLength}
      />

      <PhoneInput
        label={TEXTS.debts.phoneLabel}
        value={values.phone}
        onChangeText={(text) => set('phone', text)}
        error={errors.phone}
      />

      <Input
        label={TEXTS.debts.sectorLabel}
        placeholder={TEXTS.debts.sectorPlaceholder}
        value={values.sector}
        onChangeText={(text) => set('sector', text)}
        error={errors.sector}
        maxLength={LIMITS.sectorMaxLength}
      />

      <AmountField
        amountText={values.amountText}
        onChangeAmount={(text) => set('amountText', text)}
        currency={values.currency}
        onChangeCurrency={(currency) => set('currency', currency)}
        error={errors.amount}
      />

      <View className="gap-2">
        <Text className="text-sm font-medium text-ink">{TEXTS.debts.originLabel}</Text>
        <SegmentedControl
          options={DEBT_ORIGIN_OPTIONS}
          value={values.origin}
          onChange={(origin) => set('origin', origin)}
        />
        <Text className="text-sm text-ink-muted">
          {values.origin === 'credit'
            ? TEXTS.debts.originCreditHint
            : values.direction === 'payable'
              ? TEXTS.debts.originPayableMoney
              : TEXTS.debts.originReceivableMoney}
        </Text>
      </View>

      <DateField
        label={TEXTS.debts.dueDateLabel}
        allowFuture
        value={values.dueDate}
        onChange={(date) => set('dueDate', date)}
      />

      <Input
        label={TEXTS.transaction.noteLabel}
        placeholder={TEXTS.debts.notePlaceholder}
        value={values.note}
        onChangeText={(note) => set('note', note)}
        error={errors.note}
        multiline
        maxLength={LIMITS.noteMaxLength}
        textAlignVertical="top"
        className="min-h-[80px] py-3"
      />

      <Button
        title={TEXTS.common.save}
        loading={submitting}
        disabled={submitting || disabled}
        onPress={handleSubmit}
      />
    </View>
  );
}
