import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { FullScreenState } from '@/components/FullScreenState';
import { ErrorState } from '@/components/states/ErrorState';
import { LoadingState } from '@/components/states/LoadingState';
import { COLORS } from '@/constants/colors';
import { TEXTS } from '@/constants/texts';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useMembership } from '@/hooks/useMembership';
import { ENV_ERROR } from '@/lib/env';
import { accessState } from '@/lib/membership';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/auth';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      {ENV_ERROR === null ? (
        <AppNavigator />
      ) : (
        <FullScreenState>
          <ErrorState
            title={TEXTS.config.title}
            message={ENV_ERROR === 'secretKey' ? TEXTS.config.secretKey : TEXTS.config.missingEnv}
          />
        </FullScreenState>
      )}
      <StatusBar style="dark" />
    </QueryClientProvider>
  );
}

function AppNavigator() {
  useAuthSession();
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const isSignedIn = useAuthStore((state) => state.session !== null);

  const membership = useMembership();
  const access = isSignedIn ? accessState(membership) : 'none';
  const hasAccess = access === 'owner' || access === 'seller';
  const isOwner = access === 'owner';

  // Saqlangan sessiya va a'zolik o'qilguncha kutamiz — aks holda boshqa ekran bir lahza ko'rinib qoladi.
  if (!isInitialized || access === 'loading') {
    return (
      <FullScreenState>
        <LoadingState />
      </FullScreenState>
    );
  }

  if (access === 'error') {
    return (
      <FullScreenState>
        <ErrorState onRetry={() => void membership.refetch()} />
      </FullScreenState>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerTintColor: COLORS.primary.DEFAULT,
        headerTitleStyle: { color: COLORS.ink.DEFAULT },
        headerStyle: { backgroundColor: COLORS.background },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: COLORS.background },
      }}
    >
      {/* Faqat tizimga kirgan foydalanuvchi uchun. Kirmagan bo'lsa — aniq kirish sahifasiga
          (vebda guruh manzili "/(auth)" ochilmaydi, shuning uchun aniq sahifa ko'rsatiladi). */}
      <Stack.Protected guard={isSignedIn && hasAccess} redirectTo={isSignedIn ? '/welcome' : '/sign-in'}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="team" options={{ headerShown: true, title: TEXTS.team.title }} />
        <Stack.Screen name="order/new" options={{ headerShown: true, title: TEXTS.orders.newTitle }} />
        <Stack.Screen name="order/[id]" options={{ headerShown: true, title: TEXTS.orders.viewTitle }} />
        <Stack.Screen name="order/edit/[id]" options={{ headerShown: true, title: TEXTS.orders.editTitle }} />
        <Stack.Screen
          name="order/pay/[id]"
          options={{ presentation: 'modal', headerShown: true, title: TEXTS.orders.payTitle }}
        />
      </Stack.Protected>

      {/* Moliya ekranlari — faqat biznes egasiga */}
      <Stack.Protected guard={isSignedIn && isOwner} redirectTo={isSignedIn ? '/' : '/sign-in'}>
        <Stack.Screen name="categories" options={{ headerShown: true, title: TEXTS.categories.title }} />
        <Stack.Screen name="stock/new" options={{ headerShown: true, title: TEXTS.stock.newTitle }} />
        <Stack.Screen name="stock/[id]" options={{ headerShown: true, title: TEXTS.stock.viewTitle }} />
        <Stack.Screen name="stock/edit/[id]" options={{ headerShown: true, title: TEXTS.stock.editTitle }} />
        <Stack.Screen
          name="stock/move/[id]"
          options={{ presentation: 'modal', headerShown: true, title: TEXTS.stock.viewTitle }}
        />
        <Stack.Screen name="employee/new" options={{ headerShown: true, title: TEXTS.payroll.newTitle }} />
        <Stack.Screen name="employee/[id]" options={{ headerShown: true, title: TEXTS.payroll.viewTitle }} />
        <Stack.Screen name="employee/edit/[id]" options={{ headerShown: true, title: TEXTS.payroll.editTitle }} />
        <Stack.Screen
          name="employee/pay/[id]"
          options={{ presentation: 'modal', headerShown: true, title: TEXTS.payroll.payTitle }}
        />
        <Stack.Screen
          name="transaction/new"
          options={{ presentation: 'modal', headerShown: true, title: TEXTS.transaction.newTitle }}
        />
        <Stack.Screen
          name="transaction/[id]"
          options={{ presentation: 'modal', headerShown: true, title: TEXTS.transaction.editTitle }}
        />
        <Stack.Screen
          name="debt/new"
          options={{ presentation: 'modal', headerShown: true, title: TEXTS.debts.newTitle }}
        />
        <Stack.Screen name="debt/list/[direction]" options={{ headerShown: true, title: TEXTS.debts.title }} />
        <Stack.Screen
          name="debt/pay/[id]"
          options={{ presentation: 'modal', headerShown: true, title: TEXTS.debts.payTitle }}
        />
        <Stack.Screen
          name="debt/[id]"
          options={{ presentation: 'modal', headerShown: true, title: TEXTS.debts.editTitle }}
        />
      </Stack.Protected>

      {/* Biznesi yo'q yoki tasdiq kutayotgan foydalanuvchi */}
      <Stack.Protected guard={isSignedIn && !hasAccess} redirectTo={isSignedIn ? '/' : '/sign-in'}>
        <Stack.Screen name="welcome" />
      </Stack.Protected>

      {/* Faqat tizimga kirmagan foydalanuvchi uchun */}
      <Stack.Protected guard={!isSignedIn} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
