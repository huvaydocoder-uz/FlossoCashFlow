import { useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TEXTS } from '@/constants/texts';
import { useCreateCategory } from '@/hooks/useCategories';
import { getDbErrorMessage } from '@/lib/dbErrors';
import { validateCategoryName } from '@/lib/validation';
import type { Category, TransactionType } from '@/types/database';

type AddCategoryFormProps = {
  type: TransactionType;
  placeholder?: string;
  autoFocus?: boolean;
  onCreated?: (category: Category) => void;
};

// Yangi kategoriya qo'shish (Kategoriyalar ekranida va amal formasida ishlatiladi).
export function AddCategoryForm({
  type,
  placeholder = TEXTS.categories.addPlaceholder,
  autoFocus = false,
  onCreated,
}: AddCategoryFormProps) {
  const create = useCreateCategory();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const submit = () => {
    const validationError = validateCategoryName(name);
    setError(validationError);
    if (validationError !== undefined) {
      return;
    }
    create.mutate(
      { name, type },
      {
        onSuccess: (category) => {
          setName('');
          onCreated?.(category);
        },
      },
    );
  };

  const message = error ?? (create.isError ? getDbErrorMessage(create.error) : undefined);

  return (
    <View className="gap-1.5">
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Input
            placeholder={placeholder}
            value={name}
            onChangeText={(value) => {
              setName(value);
              setError(undefined);
              if (create.isError) {
                create.reset();
              }
            }}
            autoFocus={autoFocus}
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={submit}
            editable={!create.isPending}
          />
        </View>
        <Button title={TEXTS.common.add} onPress={submit} loading={create.isPending} />
      </View>
      {message !== undefined ? <Text className="text-sm text-danger">{message}</Text> : null}
    </View>
  );
}
