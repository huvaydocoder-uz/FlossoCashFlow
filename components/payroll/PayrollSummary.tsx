import { Text, View } from 'react-native';

import { ProgressBar } from '@/components/debts/DebtRow';
import { Card } from '@/components/ui/Card';
import { TEXTS } from '@/constants/texts';
import { formatMoney } from '@/lib/format';
import type { PayrollRow } from '@/types/database';

function Line({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <View className="flex-row justify-between gap-3">
      <Text className="text-sm text-ink-muted">{label}</Text>
      <Text className={`text-sm font-semibold ${tone ?? 'text-ink'}`}>{value}</Text>
    </View>
  );
}

// Bir xodimning oy bo'yicha hisobi: belgilangan — kunlar; foiz — savdo, pog'ona va keyingi pog'onagacha.
export function PayrollSummary({ row }: { row: PayrollRow }) {
  const currency = row.computed_currency;
  const toNext = row.next_tier_from === null ? null : Math.max(row.next_tier_from - row.sales_usd, 0);

  return (
    <Card className="gap-3">
      {row.pay_type === 'fixed' ? (
        <Line
          label={TEXTS.payroll.fixedHint}
          value={`${formatMoney(row.fixed_salary ?? 0, row.salary_currency)} ÷ ${row.norm_days} × ${row.days_worked}`}
        />
      ) : (
        <View className="gap-2">
          <Line label={TEXTS.payroll.salesLabel} value={formatMoney(row.sales_usd, 'USD')} />
          <Line label={TEXTS.payroll.percentLabel} value={`${row.percent}%`} />
          {toNext !== null && row.next_tier_from !== null ? (
            <View className="gap-1">
              <ProgressBar ratio={row.next_tier_from > 0 ? row.sales_usd / row.next_tier_from : 1} tone="income" />
              <Text className="text-xs text-ink-muted">
                {TEXTS.payroll.nextTier} ({row.next_tier_percent}%): {formatMoney(toNext, 'USD')}
              </Text>
            </View>
          ) : (
            <Text className="text-xs font-semibold text-income">{TEXTS.payroll.topTier}</Text>
          )}
        </View>
      )}
      <View className="h-px bg-line" />
      <Line label={TEXTS.payroll.totalComputed} value={formatMoney(row.computed, currency)} />
      <Line label={TEXTS.payroll.totalPaid} value={formatMoney(row.paid, currency)} />
      {row.overpaid > 0 ? (
        <Line label={TEXTS.payroll.overpaid} value={formatMoney(row.overpaid, currency)} tone="text-warning" />
      ) : (
        <Line
          label={TEXTS.payroll.totalRemaining}
          value={formatMoney(row.remaining, currency)}
          tone={row.remaining > 0 ? 'text-expense' : 'text-income'}
        />
      )}
    </Card>
  );
}
