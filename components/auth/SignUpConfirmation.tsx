import { router } from 'expo-router';
import { Text } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { TEXTS } from '@/constants/texts';

type SignUpConfirmationProps = {
  email: string;
};

// Supabase'da "Confirm email" yoqilgan bo'lsa, ro'yxatdan o'tgandan keyin ko'rsatiladi.
export function SignUpConfirmation({ email }: SignUpConfirmationProps) {
  return (
    <>
      <Text className="text-lg font-semibold text-ink">{TEXTS.auth.confirmTitle}</Text>
      <Text className="text-base font-medium text-ink-muted">{email.trim()}</Text>
      <FormMessage variant="success" message={TEXTS.auth.confirmMessage} />
      <Button
        title={TEXTS.auth.confirmButton}
        onPress={() => router.replace('/sign-in')}
        className="mt-2"
      />
    </>
  );
}
