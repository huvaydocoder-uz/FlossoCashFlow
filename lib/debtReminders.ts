import type { DebtWithPayments } from '@/types/models';

// Vebda (Safari / brauzer) rejalashtirilgan bildirishnoma yo'q — eslatma Asosiy
// sahifadagi bannerda ko'rinadi. Telefondagi ilova uchun: debtReminders.native.ts.
export async function syncDebtReminders(_debts: DebtWithPayments[]): Promise<void> {
  // vebda hech narsa qilinmaydi
}
