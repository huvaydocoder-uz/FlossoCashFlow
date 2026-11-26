import { useState, type ComponentRef, type Ref } from 'react';
import { Image, Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Input } from '@/components/ui/Input';
import { COLORS } from '@/constants/colors';
import { SIZES } from '@/constants/sizes';
import { TEXTS } from '@/constants/texts';
import { passwordChecks } from '@/lib/validation';

const EYE = require('../../assets/icons/eye.png');
const EYE_OFF = require('../../assets/icons/eye-off.png');

type PasswordInputProps = Omit<TextInputProps, 'secureTextEntry'> & {
  label: string;
  error?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
  // Ro'yxatdan o'tishda: qoidalar ro'yxati (✓) maydon ostida.
  showRules?: boolean;
};

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Text className={`text-sm ${ok ? 'text-income' : 'text-ink-muted'}`}>
      {ok ? '✓' : '○'} {label}
    </Text>
  );
}

// Parol maydoni: o'ng chetida ko'z — bosilsa parol ko'rinadi yoki yashiriladi.
export function PasswordInput({ label, error, ref, showRules = false, value, ...rest }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  const checks = passwordChecks(value ?? '');

  return (
    <View className="gap-2">
      <View>
        <Input
          ref={ref}
          label={label}
          error={error}
          value={value}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          className="pr-14"
          {...rest}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? TEXTS.auth.hidePassword : TEXTS.auth.showPassword}
          hitSlop={SIZES.hitSlop}
          onPress={() => setVisible((current) => !current)}
          className="absolute right-1 top-[26px] h-[52px] w-12 items-center justify-center active:opacity-60"
        >
          <Image
            source={visible ? EYE_OFF : EYE}
            style={{ width: 22, height: 22, tintColor: COLORS.ink.muted }}
          />
        </Pressable>
      </View>
      {showRules ? (
        <View className="gap-0.5">
          <Rule ok={checks.length} label={TEXTS.auth.ruleLength} />
          <Rule ok={checks.upper} label={TEXTS.auth.ruleUpper} />
          <Rule ok={checks.lower} label={TEXTS.auth.ruleLower} />
          <Rule ok={checks.digit} label={TEXTS.auth.ruleDigit} />
          <Text className="text-xs text-ink-subtle">{TEXTS.auth.ruleSymbolOptional}</Text>
        </View>
      ) : null}
    </View>
  );
}
