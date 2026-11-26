import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { ProfileInfo } from '@/components/profile/ProfileInfo';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { TEXTS } from '@/constants/texts';
import { useSignOut } from '@/hooks/useAuthMutations';
import { useAccess } from '@/hooks/useMembership';
import { getAuthErrorMessage } from '@/lib/authErrors';

const APP_VERSION = Constants.expoConfig?.version ?? '';

// Profil va sozlamalar: ism (tahrirlash mumkin), email, chiqish.
export default function ProfileScreen() {
  const signOut = useSignOut();
  const access = useAccess();

  return (
    <Screen title={TEXTS.profile.title}>
      <ProfileInfo />

      <View className="mt-6 gap-3">
        <MenuRow label={TEXTS.profile.team} onPress={() => router.push('/team')} />
        {access === 'owner' ? (
          <MenuRow label={TEXTS.profile.categories} onPress={() => router.push('/categories')} />
        ) : null}
      </View>

      {signOut.isError ? (
        <View className="mt-4">
          <FormMessage message={getAuthErrorMessage(signOut.error)} />
        </View>
      ) : null}

      <Button
        title={TEXTS.profile.signOut}
        variant="danger"
        loading={signOut.isPending}
        onPress={() => signOut.mutate()}
        className="mt-6"
      />

      <Text className="mt-6 text-center text-sm text-ink-subtle">
        {TEXTS.app.name} · {TEXTS.common.version} {APP_VERSION}
      </Text>
    </Screen>
  );
}

function MenuRow({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      className="min-h-control flex-row items-center justify-between rounded-control border border-line bg-surface px-4 active:opacity-70"
    >
      <Text className="text-[16px] font-medium text-ink">{label}</Text>
      <Text className="text-xl text-ink-subtle">›</Text>
    </Pressable>
  );
}
