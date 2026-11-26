import { Tabs } from 'expo-router';
import { Image, type ColorValue, type ImageSourcePropType } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS } from '@/constants/colors';
import { SIZES } from '@/constants/sizes';
import { TAB_ICONS } from '@/constants/tabIcons';
import { TEXTS } from '@/constants/texts';
import { useAccess } from '@/hooks/useMembership';
import { isTabVisible } from '@/lib/membership';

// Veb-versiya (brauzer / "Ekranga qo'shish") uchun tab paneli.
// Telefondagi native ilovada esa _layout.tsx dagi NativeTabs ishlatiladi.
function tabIcon(source: ImageSourcePropType) {
  return function TabIcon({ color }: { color: ColorValue }) {
    return (
      <Image
        source={source}
        style={{ width: SIZES.tabBar.iconSize, height: SIZES.tabBar.iconSize, tintColor: color }}
      />
    );
  };
}

function LogoIcon() {
  return <Image source={TAB_ICONS.logoWeb} style={{ width: SIZES.tabBar.logoSize, height: SIZES.tabBar.logoSize }} />;
}

export default function WebTabsLayout() {
  const insets = useSafeAreaInsets();
  const access = useAccess();
  // Yashirin tab: href null — panelda ko'rinmaydi.
  const href = (tab: string) => (isTabVisible(tab, access) ? undefined : null);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary.DEFAULT,
        tabBarInactiveTintColor: COLORS.ink.muted,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.line,
          height: SIZES.tabBar.height + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 6,
        },
        tabBarLabelStyle: { fontSize: SIZES.tabBar.labelSize, fontWeight: '600', marginTop: 2 },
        sceneStyle: { backgroundColor: COLORS.background },
      }}
    >
      <Tabs.Screen name="index" options={{ href: href('index'), title: TEXTS.tabs.dashboard, tabBarIcon: tabIcon(TAB_ICONS.home) }} />
      <Tabs.Screen name="history" options={{ href: href('history'), title: TEXTS.tabs.history, tabBarIcon: tabIcon(TAB_ICONS.history) }} />
      <Tabs.Screen
        name="flosso"
        options={{
          href: href('flosso'),
          title: TEXTS.tabs.flosso,
          tabBarAccessibilityLabel: TEXTS.tabs.flosso,
          tabBarLabel: () => null,
          tabBarIconStyle: { width: SIZES.tabBar.logoSize, height: SIZES.tabBar.logoSize },
          tabBarIcon: LogoIcon,
        }}
      />
      <Tabs.Screen name="debts" options={{ href: href('debts'), title: TEXTS.tabs.debts, tabBarIcon: tabIcon(TAB_ICONS.calendar) }} />
      <Tabs.Screen name="profile" options={{ href: href('profile'), title: TEXTS.tabs.profile, tabBarIcon: tabIcon(TAB_ICONS.person) }} />
    </Tabs>
  );
}
