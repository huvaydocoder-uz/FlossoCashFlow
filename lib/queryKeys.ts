import type { TransactionFilters } from '@/types/models';

// TanStack Query kesh kalitlari bir joyda — yangilash (invalidate) paytida adashmaslik uchun.
// Chiqishda butun kesh tozalanadi (hooks/useAuthSession.ts), shuning uchun userId shart emas.
export const queryKeys = {
  profile: (userId: string) => ['profile', userId] as const,
  membership: (userId: string) => ['membership', userId] as const,
  team: ['team'] as const,
  orders: {
    all: ['orders'] as const,
    detail: (id: string) => ['orders', 'detail', id] as const,
  },
  usdRate: (day: string) => ['usdRate', day] as const,
  stockDefaults: ['stockDefaults'] as const,
  stock: {
    all: ['stock'] as const,
    item: (id: string) => ['stock', 'item', id] as const,
  },
  sales: {
    all: ['sales'] as const,
    report: (from: string, to: string) => ['sales', 'report', from, to] as const,
  },
  payroll: {
    all: ['payroll'] as const,
    month: (month: string) => ['payroll', 'month', month] as const,
    employee: (id: string) => ['payroll', 'employee', id] as const,
    payments: (id: string, month: string) => ['payroll', 'payments', id, month] as const,
  },
  categories: ['categories'] as const,
  balances: ['balances'] as const,
  stats: (sinceIso: string) => ['transactions', 'stats', sinceIso] as const,
  debts: ['debts'] as const,
  transactions: {
    all: ['transactions'] as const,
    recent: (limit: number) => ['transactions', 'recent', limit] as const,
    list: (filters: TransactionFilters) => ['transactions', 'list', filters] as const,
    detail: (id: string) => ['transactions', 'detail', id] as const,
  },
};
