import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';

type ScreenProps = {
  title?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  // Pastga tortib yangilash (pull-to-refresh).
  refreshing?: boolean;
  onRefresh?: () => void;
};

const ALL_EDGES: Edge[] = ['top', 'right', 'bottom', 'left'];

export function ScreenTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View className="mb-4 flex-row items-center justify-between gap-3">
      <Text accessibilityRole="header" className="flex-1 text-3xl font-bold text-ink">
        {title}
      </Text>
      {right}
    </View>
  );
}

// Barcha ekranlar uchun umumiy qobiq: xavfsiz hudud, fon, sarlavha.
export function Screen({
  title,
  headerRight,
  children,
  scroll = true,
  edges = ALL_EDGES,
  refreshing = false,
  onRefresh,
}: ScreenProps) {
  const header = title !== undefined ? <ScreenTitle title={title} right={headerRight} /> : null;

  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: COLORS.background }}>
      {scroll ? (
        <ScrollView
          contentContainerClassName="flex-grow px-5 pb-8 pt-2"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          automaticallyAdjustKeyboardInsets
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.primary.DEFAULT}
              />
            ) : undefined
          }
        >
          {header}
          {children}
        </ScrollView>
      ) : (
        <View className="flex-1 px-5 pt-2">
          {header}
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
