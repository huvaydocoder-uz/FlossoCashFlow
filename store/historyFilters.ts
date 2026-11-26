import { create } from 'zustand';

import type { TransactionFilters } from '@/types/models';

export const DEFAULT_FILTERS: TransactionFilters = {
  type: 'all',
  currency: 'all',
  paymentMethod: 'all',
  categoryId: 'all',
  period: 'all',
  search: '',
};

type HistoryFiltersState = {
  filters: TransactionFilters;
  setFilter: <K extends keyof TransactionFilters>(key: K, value: TransactionFilters[K]) => void;
  reset: () => void;
};

// Tarix filtrlari tablar orasida o'tganda ham saqlanib qoladi.
export const useHistoryFilters = create<HistoryFiltersState>()((set) => ({
  filters: DEFAULT_FILTERS,
  setFilter: (key, value) => set((state) => ({ filters: { ...state.filters, [key]: value } })),
  reset: () => set({ filters: DEFAULT_FILTERS }),
}));

export function hasActiveFilters(filters: TransactionFilters): boolean {
  return (
    filters.type !== 'all' ||
    filters.currency !== 'all' ||
    filters.paymentMethod !== 'all' ||
    filters.categoryId !== 'all' ||
    filters.period !== 'all' ||
    filters.search.trim().length > 0
  );
}
