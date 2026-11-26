import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';

// Navigatsiya hali yo'q paytdagi ekranlar uchun (sessiya yuklanishi, sozlash xatosi).
export function FullScreenState({ children }: { children: ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>{children}</SafeAreaView>
  );
}
