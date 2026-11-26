import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { LIMITS } from '@/constants/limits';
import { TEXTS } from '@/constants/texts';
import { useUpdateProfileName } from '@/hooks/useProfile';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { validateFullName } from '@/lib/validation';

type EditNameFormProps = {
  initialName: string;
  onDone: () => void;
};

export function EditNameForm({ initialName, onDone }: EditNameFormProps) {
  const update = useUpdateProfileName();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = () => {
    const validationError = validateFullName(name);
    setError(validationError);
    if (validationError === undefined) {
      update.mutate(name, { onSuccess: onDone });
    }
  };

  return (
    <View className="gap-3">
      {update.isError ? <FormMessage message={getDbErrorMessage(update.error)} /> : null}
      <Input
        label={TEXTS.profile.nameLabel}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(undefined);
        }}
        error={error}
        autoFocus
        maxLength={LIMITS.fullNameMaxLength}
        autoComplete="name"
        textContentType="name"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button title={TEXTS.common.cancel} variant="ghost" onPress={onDone} disabled={update.isPending} />
        </View>
        <View className="flex-1">
          <Button title={TEXTS.common.save} onPress={submit} loading={update.isPending} />
        </View>
      </View>
    </View>
  );
}
