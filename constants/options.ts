import type { SegmentOption } from '@/components/ui/SegmentedControl';
import { TEXTS } from '@/constants/texts';
import type {
  CurrencyCode,
  DebtDirection,
  OrderStatus,
  PaymentMethod,
  ProductType,
  TransactionType,
} from '@/types/database';

// Tanlagichlar uchun variantlar.
export const TYPE_OPTIONS: readonly SegmentOption<TransactionType>[] = [
  { value: 'expense', label: TEXTS.types.expense, tone: 'expense' },
  { value: 'income', label: TEXTS.types.income, tone: 'income' },
];

export const CURRENCY_OPTIONS: readonly SegmentOption<CurrencyCode>[] = [
  { value: 'UZS', label: TEXTS.currencies.UZS },
  { value: 'USD', label: TEXTS.currencies.USD },
];

export const PAYMENT_METHOD_OPTIONS: readonly SegmentOption<PaymentMethod>[] = [
  { value: 'cash', label: TEXTS.paymentMethods.cash },
  { value: 'card', label: TEXTS.paymentMethods.card },
];

export const DEBT_DIRECTION_OPTIONS: readonly SegmentOption<DebtDirection>[] = [
  { value: 'payable', label: TEXTS.debts.payable, tone: 'expense' },
  { value: 'receivable', label: TEXTS.debts.receivable, tone: 'income' },
];

// Qarz berilganda/olinganda pul qanday o'tdi: naqd, karta yoki nasiya (pulsiz).
export type DebtOrigin = PaymentMethod | 'credit';

export const DEBT_ORIGIN_OPTIONS: readonly SegmentOption<DebtOrigin>[] = [
  { value: 'cash', label: TEXTS.paymentMethods.cash },
  { value: 'card', label: TEXTS.paymentMethods.card },
  { value: 'credit', label: TEXTS.debts.originCredit },
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: TEXTS.orders.statusNew,
  delivered: TEXTS.orders.statusDelivered,
  cancelled: TEXTS.orders.statusCancelled,
};

// Flosso mahsulot turlari (flosso.uz katalogi bo'limlari).
export const PRODUCT_TYPE_OPTIONS: readonly SegmentOption<ProductType>[] = [
  { value: 'karniz', label: 'Karniz' },
  { value: 'nalichnik', label: 'Nalichnik' },
  { value: 'kolonna_igrushka', label: 'Kolonna igrushkasi' },
  { value: 'nalichnik_igrushka', label: 'Nalichnik igrushkasi' },
  { value: 'podokonnik', label: 'Podokonnik' },
  { value: 'taroq_kolonna', label: 'Taroq-kolonna' },
  { value: 'termopanel', label: 'Termopanel' },
];

// Barcha turlar nomi (eski yozuvlardagi turlar ham to'g'ri ko'rinishi uchun).
export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  karniz: 'Karniz',
  nalichnik: 'Nalichnik',
  kolonna_igrushka: 'Kolonna igrushkasi',
  nalichnik_igrushka: 'Nalichnik igrushkasi',
  podokonnik: 'Podokonnik',
  taroq_kolonna: 'Taroq-kolonna',
  termopanel: 'Termopanel',
  rezka: 'Rezka',
  quyma: 'Quyma',
  mishalka: 'Mishalka',
};
