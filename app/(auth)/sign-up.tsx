import { useRef, useState, type ComponentRef } from 'react';
import type { TextInput } from 'react-native';

import { AuthLayout } from '@/components/auth/AuthLayout';
import { SignUpConfirmation } from '@/components/auth/SignUpConfirmation';
import { Button } from '@/components/ui/Button';
import { FormMessage } from '@/components/ui/FormMessage';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { TEXTS } from '@/constants/texts';
import { useSignUp } from '@/hooks/useAuthMutations';
import { getAuthErrorMessage } from '@/lib/authErrors';
import {
  hasErrors,
  validateEmail,
  validateFullName,
  validateNewPassword,
} from '@/lib/validation';

type Field = 'fullName' | 'email' | 'password';
type FieldErrors = Partial<Record<Field, string>>;
type InputRef = ComponentRef<typeof TextInput>;

export default function SignUpScreen() {
  const signUp = useSignUp();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const emailRef = useRef<InputRef>(null);
  const passwordRef = useRef<InputRef>(null);

  const change = (field: Field, setter: (value: string) => void) => (value: string) => {
    setter(value);
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (signUp.isError) {
      signUp.reset();
    }
  };

  const handleSubmit = () => {
    const nextErrors: FieldErrors = {
      fullName: validateFullName(fullName),
      email: validateEmail(email),
      password: validateNewPassword(password),
    };
    setErrors(nextErrors);
    if (!hasErrors(nextErrors)) {
      signUp.mutate({ fullName, email, password });
    }
  };

  // Email tasdiqlash o'chiq bo'lsa, sessiya darhol keladi va navigatsiya o'zi o'tkazadi.
  const awaitingConfirmation = signUp.data?.needsEmailConfirmation === true;

  return (
    <AuthLayout
      title={TEXTS.auth.signUpTitle}
      subtitle={TEXTS.auth.signUpSubtitle}
      footerQuestion={TEXTS.auth.haveAccount}
      footerLinkLabel={TEXTS.auth.goToSignIn}
      footerHref="/sign-in"
    >
      {awaitingConfirmation ? (
        <SignUpConfirmation email={email} />
      ) : (
        <>
          {signUp.isError ? <FormMessage message={getAuthErrorMessage(signUp.error)} /> : null}

          <Input
            label={TEXTS.auth.fullNameLabel}
            placeholder={TEXTS.auth.fullNamePlaceholder}
            value={fullName}
            onChangeText={change('fullName', setFullName)}
            error={errors.fullName}
            editable={!signUp.isPending}
            autoComplete="name"
            textContentType="name"
            returnKeyType="next"
            onSubmitEditing={() => emailRef.current?.focus()}
          />
          <Input
            ref={emailRef}
            label={TEXTS.auth.emailLabel}
            placeholder={TEXTS.auth.emailPlaceholder}
            value={email}
            onChangeText={change('email', setEmail)}
            error={errors.email}
            editable={!signUp.isPending}
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
            placeholder={TEXTS.auth.newPasswordPlaceholder}
            value={password}
            onChangeText={change('password', setPassword)}
            error={errors.password}
            editable={!signUp.isPending}
            showRules
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          <Button
            title={TEXTS.auth.signUpButton}
            loading={signUp.isPending}
            onPress={handleSubmit}
            className="mt-2"
          />
        </>
      )}
    </AuthLayout>
  );
}
