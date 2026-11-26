import { Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import { TEXTS } from '@/constants/texts';
import {
  useApproveMember,
  useLeaveBusiness,
  useMembership,
  useRemoveMember,
  useTeamMembers,
  type TeamMember,
} from '@/hooks/useMembership';
import { confirmDestructive } from '@/lib/confirm';
import { getDbErrorMessage } from '@/lib/dbErrors';

const EDGES = ['bottom', 'left', 'right'] as const;

// Egasi: qo'shilish kodi, a'zolarni tasdiqlash va chiqarish. Sotuvchi: biznes va roli, chiqish.
export default function TeamScreen() {
  const membership = useMembership();
  const data = membership.data;
  if (data === undefined || data === null) {
    return (
      <Screen edges={[...EDGES]}>
        {membership.isError ? <ErrorState onRetry={() => void membership.refetch()} /> : <LoadingState />}
      </Screen>
    );
  }

  return (
    <Screen edges={[...EDGES]}>
      <Text className="mb-4 text-2xl font-bold text-ink">{data.business.name}</Text>
      {data.role === 'owner' ? <OwnerTeam joinCode={data.business.join_code} /> : <SellerTeam />}
    </Screen>
  );
}

function OwnerTeam({ joinCode }: { joinCode: string }) {
  const members = useTeamMembers(true);
  const approve = useApproveMember();
  const remove = useRemoveMember();
  const failed = approve.error ?? remove.error;

  const confirmRemove = (member: TeamMember) =>
    confirmDestructive({
      title: TEXTS.team.removeConfirmTitle,
      message: `${member.fullName ?? TEXTS.team.noName}\n${TEXTS.team.removeConfirmMessage}`,
      confirmLabel: member.status === 'pending' ? TEXTS.team.reject : TEXTS.team.remove,
      onConfirm: () => remove.mutate(member.userId),
    });

  return (
    <View className="gap-4">
      <Card className="gap-2">
        <Text className="text-sm font-medium text-ink-muted">{TEXTS.team.joinCodeLabel}</Text>
        <Text selectable className="text-3xl font-bold tracking-[6px] text-primary">
          {joinCode}
        </Text>
        <Text className="text-sm text-ink-muted">{TEXTS.team.joinCodeHint}</Text>
      </Card>

      <Text accessibilityRole="header" className="text-xl font-bold text-ink">
        {TEXTS.team.members}
      </Text>
      {failed !== null ? <FormMessage message={getDbErrorMessage(failed)} /> : null}

      {members.isPending ? (
        <LoadingState />
      ) : members.isError ? (
        <ErrorState onRetry={() => void members.refetch()} />
      ) : (
        <Card className="py-1">
          {members.data.map((member, index) => (
            <View key={member.userId} className={`gap-2 py-3 ${index > 0 ? 'border-t border-line' : ''}`}>
              <View className="flex-row items-center justify-between gap-3">
                <Text numberOfLines={1} className="flex-1 text-base font-semibold text-ink">
                  {member.fullName ?? TEXTS.team.noName}
                </Text>
                <Text className={`text-sm font-medium ${member.status === 'pending' ? 'text-warning' : 'text-ink-muted'}`}>
                  {member.status === 'pending'
                    ? TEXTS.team.pending
                    : member.role === 'owner'
                      ? TEXTS.team.owner
                      : TEXTS.team.seller}
                </Text>
              </View>
              {member.role === 'seller' ? (
                <View className="flex-row gap-2">
                  {member.status === 'pending' ? (
                    <Button
                      title={TEXTS.team.approve}
                      loading={approve.isPending && approve.variables === member.userId}
                      onPress={() => approve.mutate(member.userId)}
                      className="flex-1"
                    />
                  ) : null}
                  <Button
                    title={member.status === 'pending' ? TEXTS.team.reject : TEXTS.team.remove}
                    variant="danger"
                    loading={remove.isPending && remove.variables === member.userId}
                    onPress={() => confirmRemove(member)}
                    className="flex-1"
                  />
                </View>
              ) : null}
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

function SellerTeam() {
  const leave = useLeaveBusiness();

  return (
    <View className="gap-4">
      <Card className="gap-1">
        <Text className="text-sm font-medium text-ink-muted">{TEXTS.team.yourRole}</Text>
        <Text className="text-lg font-semibold text-ink">{TEXTS.team.seller}</Text>
      </Card>
      {leave.isError ? <FormMessage message={getDbErrorMessage(leave.error)} /> : null}
      <Button
        title={TEXTS.team.leave}
        variant="danger"
        loading={leave.isPending}
        onPress={() =>
          confirmDestructive({
            title: TEXTS.team.leaveConfirmTitle,
            message: TEXTS.team.leaveConfirmMessage,
            confirmLabel: TEXTS.team.leave,
            onConfirm: () => leave.mutate(),
          })
        }
      />
    </View>
  );
}
