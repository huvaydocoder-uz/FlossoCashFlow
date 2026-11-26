import type { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Link, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { TEXTS } from '@/constants/texts';

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footerQuestion: string;
  footerLinkLabel: string;
  footerHref: Href;
};

// Kirish va ro'yxatdan o'tish ekranlari uchun umumiy qobiq.
export function AuthLayout({
  title,
  subtitle,
  children,
  footerQuestion,
  footerLinkLabel,
  footerHref,
}: AuthLayoutProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerClassName="flex-grow justify-center px-6 py-10"
          keyboardShouldPersistTaps="handled"
        >
          <Image
            source={require('../../assets/logo.png')}
            accessibilityLabel={TEXTS.app.name}
            resizeMode="contain"
            style={{ width: 120, height: 123, alignSelf: 'center', marginBottom: 24 }}
          />
          <Text accessibilityRole="header" className="text-3xl font-bold text-ink">
            {title}
          </Text>
          <Text className="mt-1 text-base text-ink-muted">{subtitle}</Text>

          <View className="mt-8 gap-4">{children}</View>

          <View className="mt-6 flex-row items-center justify-center gap-1">
            <Text className="text-base text-ink-muted">{footerQuestion}</Text>
            <Link href={footerHref} replace asChild>
              <Pressable accessibilityRole="link" hitSlop={8}>
                <Text className="text-base font-semibold text-primary">{footerLinkLabel}</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
