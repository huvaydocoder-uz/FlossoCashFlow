// Cheklovlar: bazadagi CHECK qoidalari va Supabase Auth sozlamalari bilan bir xil.
export const LIMITS = {
  passwordMinLength: 8,
  fullNameMaxLength: 100,
  categoryNameMaxLength: 50,
  noteMaxLength: 500,
  counterpartyMaxLength: 100,
  phoneMaxLength: 20,
  sectorMaxLength: 50,
} as const;
