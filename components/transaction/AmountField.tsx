import { Text, TextInput, View } from 'react-native';

import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { COLORS } from '@/constants/colors';
import { CURRENCY_OPTIONS } from '@/constants/options';
import { TEXTS } from '@/constants/texts';
import { formatAmountInput } from '@/lib/format';
import type { CurrencyCode } from '@/types/database';

type AmountFieldProps = {
  amountText: string;
  onChangeAmount: (value: string) => void;
  currency: CurrencyCode;
  onChangeCurrency: (value: CurrencyCode) => void;
  error?: string;
};

// Katta summa maydoni + valyuta tanlagichi (so'm / dollar).
export function AmountField({ amountText, onChangeAmount, currency, onChangeCurrency, error }: AmountFieldProps) {
  const hasError = error !== undefined;

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-ink">{TEXTS.transaction.amountLabel}</Text>
      <View
        className={`flex-row items-center rounded-control border bg-surface px-4 ${hasError ? 'border-danger' : 'border-line'}`}
      >
        {currency === 'USD' ? (
          <Text className="mr-1 text-[28px] font-bold text-ink-muted">{TEXTS.money.usdPrefix}</Text>
        ) : null}
        <TextInput
          accessibilityLabel={TEXTS.transaction.amountLabel}
          value={amountText}
          onChangeText={(text) => onChangeAmount(formatAmountInput(text))}
          placeholder={TEXTS.transaction.amountPlaceholder}
          placeholderTextColor={COLORS.ink.subtle}
          keyboardType="decimal-pad"
          className="min-h-[64px] flex-1 text-[28px] font-bold text-ink"
        />
        {currency === 'UZS' ? (
          <Text className="ml-2 text-lg font-semibold text-ink-muted">{TEXTS.money.uzsSuffix}</Text>
        ) : null}
      </View>
      {hasError ? <Text className="text-sm text-danger">{error}</Text> : null}
      <SegmentedControl options={CURRENCY_OPTIONS} value={currency} onChange={onChangeCurrency} />
    </View>
  );
}
