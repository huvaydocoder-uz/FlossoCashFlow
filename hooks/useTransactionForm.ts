import { useState } from 'react';

import { TEXTS } from '@/constants/texts';
import { formatAmountInput, parseAmountInput } from '@/lib/format';
import { hasErrors, validateNote } from '@/lib/validation';
import type { CurrencyCode, PaymentMethod, TransactionType } from '@/types/database';
import type { TransactionListItem, TransactionPayload } from '@/types/models';

export type TransactionFormValues = {
  type: TransactionType;
  amountText: string;
  currency: CurrencyCode;
  paymentMethod: PaymentMethod;
  categoryId: string | null;
  occurredAt: Date;
  note: string;
};

type FormErrors = Partial<Record<'amount' | 'category' | 'note', string>>;

const ERROR_FOR_FIELD: Record<keyof TransactionFormValues, keyof FormErrors | null> = {
  type: 'category',
  amountText: 'amount',
  currency: null,
  paymentMethod: null,
  categoryId: 'category',
  occurredAt: null,
  note: 'note',
};

export function createEmptyFormValues(): TransactionFormValues {
  return {
    type: 'expense',
    amountText: '',
    currency: 'UZS',
    paymentMethod: 'cash',
    categoryId: null,
    occurredAt: new Date(),
    note: '',
  };
}

export function toFormValues(item: TransactionListItem): TransactionFormValues {
  return {
    type: item.type,
    amountText: formatAmountInput(String(item.amount).replace('.', ',')),
    currency: item.currency,
    paymentMethod: item.payment_method,
    categoryId: item.category_id,
    occurredAt: new Date(item.occurred_at),
    note: item.note ?? '',
  };
}

export function useTransactionForm(initial: TransactionFormValues) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FormErrors>({});

  const setField = <K extends keyof TransactionFormValues>(key: K, value: TransactionFormValues[K]) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      // Tur o'zgarsa, eski kategoriya mos kelmaydi.
      return key === 'type' && value !== current.type ? { ...next, categoryId: null } : next;
    });
    const errorKey = ERROR_FOR_FIELD[key];
    if (errorKey !== null) {
      setErrors((current) => ({ ...current, [errorKey]: undefined }));
    }
  };

  // To'g'ri bo'lsa — bazaga yuboriladigan ma'lumot, aks holda null (xatolar ko'rsatiladi).
  const validate = (): TransactionPayload | null => {
    const amount = parseAmountInput(values.amountText);
    const nextErrors: FormErrors = {
      amount:
        values.amountText.trim().length === 0
          ? TEXTS.validation.amountRequired
          : amount === null || amount <= 0
            ? TEXTS.validation.amountInvalid
            : undefined,
      category: values.categoryId === null ? TEXTS.validation.categoryRequired : undefined,
      note: validateNote(values.note),
    };
    setErrors(nextErrors);
    if (hasErrors(nextErrors) || amount === null) {
      return null;
    }
    const note = values.note.trim();
    return {
      type: values.type,
      amount,
      currency: values.currency,
      payment_method: values.paymentMethod,
      category_id: values.categoryId,
      occurred_at: values.occurredAt.toISOString(),
      note: note.length > 0 ? note : null,
    };
  };

  return { values, errors, setField, validate };
}
