import { useState } from 'react';
import { Image, Text, View } from 'react-native';

import { Input } from '@/components/ui/Input';
import { TEXTS } from '@/constants/texts';
import { flagUrl, normalizePhone, phoneCountry } from '@/lib/phone';

type PhoneInputProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  editable?: boolean;
};

function Flag({ country }: { country: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <Text className="text-xs font-bold text-ink-muted">{country}</Text>;
  }
  return (
    <Image
      source={{ uri: flagUrl(country) }}
      accessibilityLabel={country}
      onError={() => setFailed(true)}
      style={{ width: 24, height: 17, borderRadius: 3 }}
    />
  );
}

// Istalgan davlat raqami: kod bo'yicha davlat avtomatik aniqlanadi va bayrog'i ko'rsatiladi.
// "+" siz kiritilsa — O'zbekiston (+998) deb olinadi.
export function PhoneInput({ label, value, onChangeText, error, editable = true }: PhoneInputProps) {
  const country = phoneCountry(value) ?? phoneCountry(normalizePhone(value) ?? '');

  return (
    <View>
      <Input
        label={label}
        placeholder={TEXTS.debts.phonePlaceholder}
        value={value}
        onChangeText={onChangeText}
        error={error}
        keyboardType="phone-pad"
        autoComplete="tel"
        maxLength={24}
        editable={editable}
        className={country !== null ? 'pl-12' : ''}
      />
      {country !== null ? (
        <View pointerEvents="none" className="absolute left-4 top-[26px] h-[52px] justify-center">
          <Flag key={country} country={country} />
        </View>
      ) : null}
    </View>
  );
}
