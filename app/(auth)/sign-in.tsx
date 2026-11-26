import { useRef, useState, type ComponentRef } from 'react';
import type { TextInput } from 'react-native';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TEXTS } from '@/constants/texts';
import { useSignIn } from '@/hooks/useAuthMutations';
import { getAuthErrorMessage } from '@/lib/authErrors';
import { hasErrors, validateEmail, validatePasswordRequired } from '@/lib/validation';

type Field = 'email' | 'password';
type FieldErrors = Partial<Record<Field, string>>;

export default function SignInScreen() {
  const signIn = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);

  const clearError = (field: Field) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (signIn.isError) {
      signIn.reset();
    }
  };

  const handleSubmit = () => {
    const nextErrors: FieldErrors = {
      email: validateEmail(email),
      password: validatePasswordRequired(password),
    };
    setErrors(nextErrors);
    if (!hasErrors(nextErrors)) {
      signIn.mutate({ email, password });
    }
  };

  return (
    <AuthLayout
      title={TEXTS.auth.signInTitle}
      subtitle={TEXTS.auth.signInSubtitle}
      footerQuestion={TEXTS.auth.noAccount}
      footerLinkLabel={TEXTS.auth.goToSignUp}
      footerHref="/sign-up"
    >
      {signIn.isError ? <FormMessage message={getAuthErrorMessage(signIn.error)} /> : null}

      <Input
        label={TEXTS.auth.emailLabel}
        placeholder={TEXTS.auth.emailPlaceholder}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          clearError('email');
        }}
        error={errors.email}
        editable={!signIn.isPending}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <PasswordInput
        ref={passwordRef}
        label={TEXTS.auth.passwordLabel}
        placeholder={TEXTS.auth.passwordPlaceholder}
        value={password}
        onChangeText={(value) => {
          setPassword(value);
          clearError('password');
        }}
        error={errors.password}
        editable={!signIn.isPending}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
      />

      <Button
        title={TEXTS.auth.signInButton}
        loading={signIn.isPending}
        onPress={handleSubmit}
        className="mt-2"
      />
    </AuthLayout>
  );
}
