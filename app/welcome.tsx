import { useState } from 'react';
import { Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { TEXTS } from '@/constants/texts';
import { useSignOut } from '@/hooks/useAuthMutations';
import { useCreateBusiness, useJoinBusiness, useLeaveBusiness, useMembership } from '@/hooks/useMembership';
import { getDbErrorMessage } from '@/lib/dbErrors';

const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

function validateBusinessName(value: string): string | undefined {
  const name = value.trim();
  if (name.length === 0) {
    return TEXTS.welcome.nameRequired;
  }
  return name.length > 100 ? TEXTS.welcome.nameTooLong : undefined;
}

// Biznesi yo'q foydalanuvchi: biznes yaratadi yoki kod bilan qo'shiladi.
// So'rov yuborgan bo'lsa — egasi tasdiqlashini kutadi.
export default function WelcomeScreen() {
  const membership = useMembership();
  const signOut = useSignOut();
  const isPending = membership.data?.status === 'pending';

  return (
    <Screen title={isPending ? TEXTS.welcome.pendingTitle : TEXTS.welcome.title}>
      {isPending ? <PendingRequest businessName={membership.data?.business.name ?? ''} /> : <CreateOrJoin />}
      <Button
        title={TEXTS.welcome.signOut}
        variant="ghost"
        loading={signOut.isPending}
        onPress={() => signOut.mutate()}
        className="mt-4"
      />
    </Screen>
  );
}

function PendingRequest({ businessName }: { businessName: string }) {
  const membership = useMembership();
  const leave = useLeaveBusiness();

  return (
    <View className="gap-4">
      <Card className="gap-1">
        <Text className="text-lg font-semibold text-ink">{businessName}</Text>
        <Text className="text-base text-ink-muted">{TEXTS.welcome.pendingMessage}</Text>
      </Card>
      {leave.isError ? <FormMessage message={getDbErrorMessage(leave.error)} /> : null}
      <Button
        title={TEXTS.welcome.refresh}
        loading={membership.isFetching}
        onPress={() => void membership.refetch()}
      />
      <Button
        title={TEXTS.welcome.cancelRequest}
        variant="secondary"
        loading={leave.isPending}
        onPress={() => leave.mutate()}
      />
    </View>
  );
}

function CreateOrJoin() {
  const create = useCreateBusiness();
  const join = useJoinBusiness();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [nameError, setNameError] = useState<string>();
  const [codeError, setCodeError] = useState<string>();
  const busy = create.isPending || join.isPending;

  const submitCreate = () => {
    const error = validateBusinessName(name);
    setNameError(error);
    if (error === undefined) {
      create.mutate(name);
    }
  };

  const submitJoin = () => {
    const normalized = code.trim().toUpperCase();
    const error = CODE_PATTERN.test(normalized) ? undefined : TEXTS.welcome.codeInvalid;
    setCodeError(error);
    if (error === undefined) {
      join.mutate(normalized);
    }
  };

  return (
    <View className="gap-5">
      <Text className="text-base text-ink-muted">{TEXTS.welcome.subtitle}</Text>

      <Card className="gap-3">
        <Text className="text-lg font-semibold text-ink">{TEXTS.welcome.joinTitle}</Text>
        <Text className="text-sm text-ink-muted">{TEXTS.welcome.joinHint}</Text>
        {join.isError ? <FormMessage message={getDbErrorMessage(join.error)} /> : null}
        <Input
          label={TEXTS.welcome.codeLabel}
          placeholder={TEXTS.welcome.codePlaceholder}
          value={code}
          onChangeText={(value) => {
            setCode(value.toUpperCase());
            setCodeError(undefined);
            join.reset();
          }}
          error={codeError}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          editable={!busy}
          returnKeyType="send"
          onSubmitEditing={submitJoin}
        />
        <Button title={TEXTS.welcome.joinButton} loading={join.isPending} disabled={busy} onPress={submitJoin} />
      </Card>

      <Card className="gap-3">
        <Text className="text-lg font-semibold text-ink">{TEXTS.welcome.createTitle}</Text>
        <Text className="text-sm text-ink-muted">{TEXTS.welcome.createHint}</Text>
        {create.isError ? <FormMessage message={getDbErrorMessage(create.error)} /> : null}
        <Input
          label={TEXTS.welcome.nameLabel}
          placeholder={TEXTS.welcome.namePlaceholder}
          value={name}
          onChangeText={(value) => {
            setName(value);
            setNameError(undefined);
            create.reset();
          }}
          error={nameError}
          maxLength={100}
          editable={!busy}
          returnKeyType="done"
          onSubmitEditing={submitCreate}
        />
        <Button
          title={TEXTS.welcome.createButton}
          variant="secondary"
          loading={create.isPending}
          disabled={busy}
          onPress={submitCreate}
        />
      </Card>
    </View>
  );
}
