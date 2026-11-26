import { Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { TEXTS } from '@/constants/texts';
import { formatMoney, formatSignedMoney } from '@/lib/format';
import type { CurrencyCode } from '@/types/database';
import type { CurrencyBalances } from '@/types/models';

type BalanceCardProps = {
  title: string;
  currency: CurrencyCode;
  summary: CurrencyBalances;
};

function AccountTile({ label, amount, currency }: { label: string; amount: number; currency: CurrencyCode }) {
  return (
    <View className="flex-1 rounded-control border border-line px-3 py-2">
      <Text className="text-xs font-medium text-ink-muted">{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className={`text-[17px] font-bold ${amount < 0 ? 'text-expense' : 'text-ink'}`}
      >
        {formatMoney(amount, currency)}
      </Text>
    </View>
  );
}

// Bitta valyuta: jami balans, naqd va karta alohida, jami kirim va chiqim.
export function BalanceCard({ title, currency, summary }: BalanceCardProps) {
  const { total } = summary;

  return (
    <Card>
      <Text className="text-sm font-medium text-ink-muted">
        {title} · {TEXTS.dashboard.totalLabel}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        className={`mt-1 text-3xl font-bold ${total.balance < 0 ? 'text-expense' : 'text-ink'}`}
      >
        {formatMoney(total.balance, currency)}
      </Text>

      <View className="mt-3 flex-row gap-3">
        <AccountTile label={`💵 ${TEXTS.dashboard.cashTitle}`} amount={summary.cash.balance} currency={currency} />
        <AccountTile label={`💳 ${TEXTS.dashboard.cardTitle}`} amount={summary.card.balance} currency={currency} />
      </View>

      <View className="mt-3 flex-row gap-3">
        <View className="flex-1 rounded-control bg-income-soft px-3 py-2">
          <Text className="text-xs font-medium text-income">{TEXTS.types.income}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit className="text-[15px] font-semibold text-income">
            {formatSignedMoney(total.income, currency, 'income')}
          </Text>
        </View>
        <View className="flex-1 rounded-control bg-expense-soft px-3 py-2">
          <Text className="text-xs font-medium text-expense">{TEXTS.types.expense}</Text>
          <Text numberOfLines={1} adjustsFontSizeToFit className="text-[15px] font-semibold text-expense">
            {formatSignedMoney(total.expense, currency, 'expense')}
          </Text>
        </View>
      </View>
    </Card>
  );
}
