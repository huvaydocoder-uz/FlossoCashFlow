import type {
  Category,
  CurrencyCode,
  Debt,
  DebtDirection,
  DebtPayment,
  Database,
  OrderListRow,
  OrderPayment,
  PaymentMethod,
  ProductType,
  Transaction,
  TransactionType,
} from '@/types/database';

// Ro'yxatlarda ishlatiladigan tranzaksiya (kategoriya nomi bilan birga).
export type TransactionListItem = Pick<
  Transaction,
  | 'id'
  | 'type'
  | 'amount'
  | 'currency'
  | 'payment_method'
  | 'note'
  | 'occurred_at'
  | 'created_at'
  | 'category_id'
  | 'source'
  | 'debt_id'
> & {
  category: Pick<Category, 'id' | 'name'> | null;
};

// Bazaga yoziladigan tranzaksiya ma'lumotlari.
export type TransactionPayload = {
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  payment_method: PaymentMethod;
  category_id: string | null;
  occurred_at: string;
  note: string | null;
};

export type HistoryPeriod = 'all' | 'today' | 'week' | 'month';

export type TransactionFilters = {
  type: TransactionType | 'all';
  currency: CurrencyCode | 'all';
  paymentMethod: PaymentMethod | 'all';
  categoryId: string | 'all';
  period: HistoryPeriod;
  search: string;
};

export type CurrencySummary = {
  balance: number;
  income: number;
  expense: number;
};

// Har bir valyuta bo'yicha: jami, naqd va karta alohida.
export type CurrencyBalances = Record<PaymentMethod | 'total', CurrencySummary>;

export type BalanceSummary = Record<CurrencyCode, CurrencyBalances>;

// Qarz formasi orqali bazaga yoziladigan ma'lumot.
export type DebtPayload = {
  direction: DebtDirection;
  counterparty: string;
  amount: number;
  currency: CurrencyCode;
  due_date: string;
  note: string | null;
  phone: string | null;
  sector: string | null;
  // null — nasiya: pul harakatlanmagan.
  origin_method: PaymentMethod | null;
};

export type DebtStatus = 'paid' | 'overdue' | 'today' | 'upcoming';

// Qarz va uning to'lovlari (ro'yxat va qarz sahifasi uchun).
export type DebtPaymentItem = Pick<
  DebtPayment,
  'id' | 'amount' | 'currency' | 'rate_uzs_per_usd' | 'payment_method' | 'paid_at'
>;
export type DebtWithPayments = Debt & { payments: DebtPaymentItem[] };

// Buyurtma: ro'yxat qatori (pul maydonlari ko'rish huquqi bo'lmasa null).
export type OrderListItem = OrderListRow;

export type OrderItemInput = {
  product_type: ProductType;
  name: string;
  quantity: number;
  // Ombordagi mahsulot (bo'lsa — yetkazilganda ombordan ayiriladi).
  stock_item_id: string | null;
};

export type OrderPaymentItem = Pick<
  OrderPayment,
  'id' | 'amount' | 'currency' | 'payment_method' | 'rate_uzs_per_usd' | 'amount_usd' | 'is_advance' | 'paid_at'
>;

export type OrderDetail = OrderListItem & {
  items: Array<OrderItemInput & { id: string }>;
  payments: OrderPaymentItem[];
};

// Buyurtma formasi orqali bazaga yoziladigan ma'lumot (holat alohida o'zgartiriladi).
export type OrderPayload = Omit<Database['public']['Tables']['orders']['Update'], 'status'> & {
  customer_name: string;
  agreed_price: number;
  currency: CurrencyCode;
};

// Avans yoki to'lov: summa, valyuta, naqd/karta, kurs (1 $ = N so'm).
export type AdvanceInput = {
  amount: number;
  currency: CurrencyCode;
  method: PaymentMethod;
  rate: number;
};
