import * as Notifications from 'expo-notifications';

import { TEXTS } from '@/constants/texts';
import { debtProgress, parseDueDate } from '@/lib/debts';
import { formatMoney } from '@/lib/format';
import type { DebtWithPayments } from '@/types/models';

const REMINDER_HOUR = 9;
const MARKER = 'debt-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// To'lanmagan har bir qarz uchun: muddatdan 1 kun oldin va muddat kuni soat 9:00 da eslatma.
// Har safar ro'yxat yangilanganda eski qarz eslatmalari o'chirilib, qaytadan qo'yiladi.
export async function syncDebtReminders(debts: DebtWithPayments[]): Promise<void> {
  try {
    const permissions = await Notifications.getPermissionsAsync();
    let granted = permissions.granted;
    if (!granted && permissions.canAskAgain) {
      granted = (await Notifications.requestPermissionsAsync()).granted;
    }
    if (!granted) {
      return;
    }

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((item) => item.content.data?.[MARKER] === true)
        .map((item) => Notifications.cancelScheduledNotificationAsync(item.identifier)),
    );

    const now = Date.now();
    for (const debt of debts) {
      if (debt.paid_at !== null) {
        continue;
      }
      const dueDay = parseDueDate(debt.due_date);
      const amount = formatMoney(debtProgress(debt).remaining, debt.currency);
      const action =
        debt.direction === 'payable' ? TEXTS.debts.notificationPayable : TEXTS.debts.notificationReceivable;
      for (const daysBefore of [1, 0]) {
        const at = new Date(dueDay);
        at.setDate(at.getDate() - daysBefore);
        at.setHours(REMINDER_HOUR, 0, 0, 0);
        if (at.getTime() <= now) {
          continue;
        }
        await Notifications.scheduleNotificationAsync({
          content: {
            title: TEXTS.debts.notificationTitle,
            body: `${daysBefore === 0 ? action : `Ertaga: ${action.toLowerCase()}`} — ${debt.counterparty}, ${amount}`,
            data: { [MARKER]: true, debtId: debt.id },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
        });
      }
    }
  } catch {
    // Eslatma qo'yilmasa ham ilova ishlashda davom etadi.
  }
}
