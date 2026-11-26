// Baza tiplari: supabase/migrations/ dagi barcha fayllar bilan mos.
// Sxema o'zgarsa, shu fayl ham yangilanadi.

export type TransactionType = 'income' | 'expense';
export type CurrencyCode = 'UZS' | 'USD';
export type PaymentMethod = 'cash' | 'card';
export type DebtDirection = 'payable' | 'receivable';
export type MemberRole = 'owner' | 'seller';
export type TransactionSource = 'manual' | 'debt_origin' | 'debt_payment' | 'order_payment' | 'salary_payment';
export type EmployeePayType = 'fixed' | 'commission';
export type StockKind = 'product' | 'material';
export type StockUnit = 'dona' | 'kg' | 'metr';
export type StockDirection = 'in' | 'out';
export type StockReason = 'production' | 'purchase' | 'writeoff' | 'adjustment' | 'order';

export type SalesReportRow = {
  month: string;
  seller_id: string | null;
  seller_name: string | null;
  orders_count: number;
  delivered_count: number;
  cancelled_count: number;
  agreed_uzs: number;
  agreed_usd: number;
  paid_usd: number;
  remaining_uzs: number;
  remaining_usd: number;
};

export type TopProductRow = {
  product_type: ProductType;
  name: string;
  stock_item_id: string | null;
  quantity: number;
  orders_count: number;
};
export type SalaryPaymentKind = 'advance' | 'salary';

type EmployeeFields = {
  full_name: string;
  phone: string | null;
  position: string | null;
  pay_type: EmployeePayType;
  fixed_salary: number | null;
  salary_currency: CurrencyCode;
  norm_days: number;
  member_user_id: string | null;
  active: boolean;
};

export type PayrollRow = {
  employee_id: string;
  full_name: string;
  phone: string | null;
  position: string | null;
  pay_type: EmployeePayType;
  member_user_id: string | null;
  active: boolean;
  fixed_salary: number | null;
  salary_currency: CurrencyCode;
  norm_days: number;
  days_worked: number;
  sales_usd: number;
  percent: number;
  next_tier_from: number | null;
  next_tier_percent: number | null;
  computed: number;
  computed_currency: CurrencyCode;
  paid: number;
  remaining: number;
  overpaid: number;
};

export type OrderStatus = 'new' | 'delivered' | 'cancelled';
// Flosso turlari; rezka/quyma/mishalka — eski (shablon) qiymatlar, bazada qolgan.
export type ProductType =
  | 'karniz'
  | 'nalichnik'
  | 'kolonna_igrushka'
  | 'nalichnik_igrushka'
  | 'podokonnik'
  | 'taroq_kolonna'
  | 'termopanel'
  | 'rezka'
  | 'quyma'
  | 'mishalka';

type OrderFields = {
  customer_name: string;
  phone: string | null;
  address: string | null;
  location_url: string | null;
  latitude: number | null;
  longitude: number | null;
  agreed_price: number;
  discount: number;
  currency: CurrencyCode;
  order_date: string;
  delivery_date: string | null;
  status: OrderStatus;
  free_delivery: boolean;
  installation: boolean;
  training: boolean;
  molds: boolean;
  penoplast_count: number;
  sand_kg: number;
  chemicals_kg: number;
  note: string | null;
};

export type MemberStatus = 'pending' | 'active';

type BusinessRow = {
  id: string;
  name: string;
  owner_id: string;
  join_code: string;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          // Kim yozgan; akkaunti o'chirilgan bo'lsa — null.
          user_id: string | null;
          business_id: string;
          name: string;
          type: TransactionType;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          business_id?: string;
          name: string;
          type: TransactionType;
          created_at?: string;
        };
        Update: {
          name?: string;
          type?: TransactionType;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      transactions: {
        Row: {
          id: string;
          // Kim yozgan; akkaunti o'chirilgan bo'lsa — null.
          user_id: string | null;
          business_id: string;
          category_id: string | null;
          type: TransactionType;
          amount: number;
          currency: CurrencyCode;
          payment_method: PaymentMethod;
          note: string | null;
          occurred_at: string;
          source: TransactionSource;
          debt_id: string | null;
          order_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          business_id?: string;
          category_id?: string | null;
          type: TransactionType;
          amount: number;
          currency: CurrencyCode;
          payment_method?: PaymentMethod;
          note?: string | null;
          occurred_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string | null;
          type?: TransactionType;
          amount?: number;
          currency?: CurrencyCode;
          payment_method?: PaymentMethod;
          note?: string | null;
          occurred_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'transactions_category_fkey';
            columns: ['category_id', 'business_id', 'type'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id', 'business_id', 'type'];
          },
          {
            foreignKeyName: 'transactions_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      debts: {
        Row: {
          id: string;
          // Kim yozgan; akkaunti o'chirilgan bo'lsa — null.
          user_id: string | null;
          business_id: string;
          direction: DebtDirection;
          counterparty: string;
          amount: number;
          currency: CurrencyCode;
          due_date: string;
          note: string | null;
          phone: string | null;
          sector: string | null;
          origin_method: PaymentMethod | null;
          origin_transaction_id: string | null;
          paid_at: string | null;
          transaction_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          business_id?: string;
          direction: DebtDirection;
          counterparty: string;
          amount: number;
          currency: CurrencyCode;
          due_date: string;
          note?: string | null;
          phone?: string | null;
          sector?: string | null;
          origin_method?: PaymentMethod | null;
        };
        Update: {
          direction?: DebtDirection;
          counterparty?: string;
          amount?: number;
          currency?: CurrencyCode;
          due_date?: string;
          note?: string | null;
          phone?: string | null;
          sector?: string | null;
          origin_method?: PaymentMethod | null;
        };
        Relationships: [];
      };
      debt_payments: {
        Row: {
          id: string;
          business_id: string;
          debt_id: string;
          user_id: string | null;
          amount: number;
          currency: CurrencyCode;
          rate_uzs_per_usd: number | null;
          payment_method: PaymentMethod;
          paid_at: string;
          transaction_id: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'debt_payments_debt_id_fkey';
            columns: ['debt_id'];
            isOneToOne: false;
            referencedRelation: 'debts';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: OrderFields & {
          id: string;
          business_id: string;
          number: number;
          seller_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<OrderFields> & Pick<OrderFields, 'customer_name' | 'agreed_price' | 'currency'> & { seller_id?: string | null };
        Update: Partial<OrderFields> & { seller_id?: string | null };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          business_id: string;
          product_type: ProductType;
          name: string;
          quantity: number;
          stock_item_id: string | null;
          created_at: string;
        };
        Insert: { order_id: string; product_type: ProductType; name: string; quantity: number; stock_item_id?: string | null };
        Update: { product_type?: ProductType; name?: string; quantity?: number };
        Relationships: [];
      };
      order_payments: {
        Row: {
          id: string;
          order_id: string;
          business_id: string;
          amount: number;
          currency: CurrencyCode;
          payment_method: PaymentMethod;
          rate_uzs_per_usd: number;
          amount_usd: number;
          is_advance: boolean;
          paid_at: string;
          received_by: string | null;
          transaction_id: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      employees: {
        Row: EmployeeFields & {
          id: string;
          business_id: string;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<EmployeeFields> & Pick<EmployeeFields, 'full_name' | 'pay_type'>;
        Update: Partial<EmployeeFields>;
        Relationships: [];
      };
      commission_tiers: {
        Row: { id: string; employee_id: string; business_id: string; from_usd: number; percent: number };
        Insert: { employee_id: string; from_usd: number; percent: number };
        Update: { from_usd?: number; percent?: number };
        Relationships: [];
      };
      payroll_days: {
        Row: { employee_id: string; business_id: string; month: string; days_worked: number };
        Insert: { employee_id: string; month: string; days_worked: number };
        Update: { days_worked?: number };
        Relationships: [];
      };
      salary_payments: {
        Row: {
          id: string;
          employee_id: string;
          business_id: string;
          month: string;
          amount: number;
          currency: CurrencyCode;
          rate_uzs_per_usd: number | null;
          payment_method: PaymentMethod;
          kind: SalaryPaymentKind;
          paid_at: string;
          paid_by: string | null;
          transaction_id: string | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      stock_items: {
        Row: {
          id: string;
          business_id: string;
          kind: StockKind;
          product_type: ProductType | null;
          name: string;
          code: string | null;
          price: number | null;
          unit: StockUnit;
          min_qty: number;
          system_key: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          kind: StockKind;
          product_type?: ProductType | null;
          name: string;
          code?: string | null;
          price?: number | null;
          unit?: StockUnit;
          min_qty?: number;
          active?: boolean;
        };
        Update: {
          kind?: StockKind;
          product_type?: ProductType | null;
          name?: string;
          code?: string | null;
          price?: number | null;
          unit?: StockUnit;
          min_qty?: number;
          active?: boolean;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          id: string;
          business_id: string;
          stock_item_id: string;
          direction: StockDirection;
          quantity: number;
          reason: StockReason;
          order_id: string | null;
          note: string | null;
          moved_at: string;
          user_id: string | null;
          created_at: string;
        };
        Insert: {
          stock_item_id: string;
          direction: StockDirection;
          quantity: number;
          reason: StockReason;
          note?: string | null;
          moved_at?: string;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: 'stock_movements_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
        ];
      };
      businesses: {
        Row: BusinessRow;
        Insert: { name: string; owner_id: string; join_code: string };
        Update: { name?: string };
        Relationships: [];
      };
      business_members: {
        Row: {
          business_id: string;
          user_id: string;
          role: MemberRole;
          status: MemberStatus;
          created_at: string;
        };
        Insert: { business_id: string; user_id: string; role: MemberRole; status?: MemberStatus };
        Update: { status?: MemberStatus };
        Relationships: [
          {
            foreignKeyName: 'business_members_business_id_fkey';
            columns: ['business_id'];
            isOneToOne: false;
            referencedRelation: 'businesses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'business_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      stock_balances: {
        Row: { stock_item_id: string; business_id: string; quantity: number };
        Relationships: [];
      };
      order_list: {
        Row: Omit<OrderFields, 'agreed_price' | 'discount' | 'currency'> & {
          id: string;
          business_id: string;
          number: number;
          seller_id: string | null;
          seller_name: string | null;
          created_at: string;
          updated_at: string;
          can_see_money: boolean;
          currency: CurrencyCode | null;
          agreed_price: number | null;
          discount: number | null;
          paid: number | null;
          remaining: number | null;
        };
        Relationships: [];
      };
      balances: {
        Row: {
          business_id: string | null;
          currency: CurrencyCode | null;
          total_income: number | null;
          total_expense: number | null;
          balance: number | null;
          payment_method: PaymentMethod | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      pay_debt: {
        Args: { p_debt_id: string; p_payment_method: PaymentMethod; p_paid_at?: string };
        Returns: undefined;
      };
      unpay_debt: {
        Args: { p_debt_id: string };
        Returns: undefined;
      };
      add_debt_payment: {
        Args: {
          p_debt_id: string;
          p_amount: number;
          p_payment_method: PaymentMethod;
          p_paid_at?: string;
          p_currency?: CurrencyCode;
          p_rate?: number | null;
        };
        Returns: string;
      };
      delete_debt_payment: {
        Args: { p_payment_id: string };
        Returns: undefined;
      };
      add_order_payment: {
        Args: {
          p_order_id: string;
          p_amount: number;
          p_currency: CurrencyCode;
          p_payment_method: PaymentMethod;
          p_rate: number;
          p_is_advance?: boolean;
          p_paid_at?: string;
        };
        Returns: string;
      };
      delete_order_payment: {
        Args: { p_payment_id: string };
        Returns: undefined;
      };
      ensure_stock_defaults: {
        Args: Record<string, never>;
        Returns: undefined;
      };
      sales_report: {
        Args: { p_from: string; p_to: string };
        Returns: SalesReportRow[];
      };
      top_products: {
        Args: { p_from: string; p_to: string };
        Returns: TopProductRow[];
      };
      save_employee: {
        Args: {
          p_id: string | null;
          p_employee: Record<string, unknown>;
          p_tiers: Array<{ from_usd: number; percent: number }>;
        };
        Returns: string;
      };
      payroll: {
        Args: { p_month: string };
        Returns: PayrollRow[];
      };
      add_salary_payment: {
        Args: {
          p_employee_id: string;
          p_month: string;
          p_amount: number;
          p_currency: CurrencyCode;
          p_payment_method: PaymentMethod;
          p_rate: number | null;
          p_kind: SalaryPaymentKind;
          p_paid_at?: string;
        };
        Returns: string;
      };
      delete_salary_payment: {
        Args: { p_payment_id: string };
        Returns: undefined;
      };
      create_business: {
        Args: { p_name: string };
        Returns: BusinessRow;
      };
      join_business: {
        Args: { p_code: string };
        Returns: string;
      };
      approve_member: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      remove_member: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      leave_business: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: {
      transaction_type: TransactionType;
      currency_code: CurrencyCode;
      payment_method: PaymentMethod;
      debt_direction: DebtDirection;
      member_role: MemberRole;
      member_status: MemberStatus;
      order_status: OrderStatus;
      employee_pay_type: EmployeePayType;
      stock_kind: StockKind;
      stock_unit: StockUnit;
      stock_direction: StockDirection;
      stock_reason: StockReason;
      salary_payment_kind: SalaryPaymentKind;
      product_type: ProductType;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type UserProfile = Database['public']['Tables']['users']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Balance = Database['public']['Views']['balances']['Row'];
export type Debt = Database['public']['Tables']['debts']['Row'];
export type Business = BusinessRow;
export type Order = Database['public']['Tables']['orders']['Row'];
export type OrderItem = Database['public']['Tables']['order_items']['Row'];
export type OrderPayment = Database['public']['Tables']['order_payments']['Row'];
export type StockItem = Database['public']['Tables']['stock_items']['Row'];
export type StockMovement = Database['public']['Tables']['stock_movements']['Row'];
export type Employee = Database['public']['Tables']['employees']['Row'];
export type CommissionTier = Database['public']['Tables']['commission_tiers']['Row'];
export type SalaryPayment = Database['public']['Tables']['salary_payments']['Row'];
export type OrderListRow = Database['public']['Views']['order_list']['Row'];
export type DebtPayment = Database['public']['Tables']['debt_payments']['Row'];
export type BusinessMember = Database['public']['Tables']['business_members']['Row'];
