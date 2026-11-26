import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { EditNameForm } from '@/components/profile/EditNameForm';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Card } from '@/components/ui/Card';
import { SIZES } from '@/constants/sizes';
import { TEXTS } from '@/constants/texts';
import { useProfile } from '@/hooks/useProfile';
import { useAuthStore } from '@/store/auth';

type InfoRowProps = {
  label: string;
  value: string;
  muted?: boolean;
  onEdit?: () => void;
};

function InfoRow({ label, value, muted = false, onEdit }: InfoRowProps) {
  return (
    <View className="flex-row items-center gap-3">
      <View className="flex-1 gap-1">
        <Text className="text-sm text-ink-muted">{label}</Text>
        <Text className={`text-base font-medium ${muted ? 'text-ink-subtle' : 'text-ink'}`}>{value}</Text>
      </View>
      {onEdit !== undefined ? (
        <Pressable accessibilityRole="button" hitSlop={SIZES.hitSlop} onPress={onEdit}>
          <Text className="text-base font-medium text-primary">{TEXTS.common.edit}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

// Ism public.users jadvalidan (Supabase'dan o'qiladi va yoziladi), email — sessiyadan.
export function ProfileInfo() {
  const email = useAuthStore((state) => state.session?.user.email ?? '');
  const profile = useProfile();
  const [editing, setEditing] = useState(false);

  if (profile.isPending) {
    return <LoadingState />;
  }

  if (profile.isError) {
    return <ErrorState onRetry={() => void profile.refetch()} />;
  }

  const fullName = profile.data?.full_name ?? null;

  return (
    <Card className="gap-4">
      {editing ? (
        <EditNameForm initialName={fullName ?? ''} onDone={() => setEditing(false)} />
      ) : (
        <InfoRow
          label={TEXTS.profile.nameLabel}
          value={fullName ?? TEXTS.profile.noName}
          muted={fullName === null}
          onEdit={() => setEditing(true)}
        />
      )}
      <View className="h-px bg-line" />
      <InfoRow label={TEXTS.profile.emailLabel} value={email} />
    </Card>
  );
}
