import { NativeTabs } from 'expo-router/native-tabs';

import { COLORS } from '@/constants/colors';
import { SIZES } from '@/constants/sizes';
import { TAB_ICONS } from '@/constants/tabIcons';
import { TEXTS } from '@/constants/texts';
import { useAccess } from '@/hooks/useMembership';
import { isTabVisible } from '@/lib/membership';

// Tizimning o'z tab paneli. iPhone'da SF Symbols, Android'da loyihadagi chiziqli ikonkalar.
// O'rtadagi bo'lim — yozuvsiz, aylana ichida Flosso logotipi.
export default function TabsLayout() {
  const access = useAccess();
  const hidden = (tab: string) => !isTabVisible(tab, access);

  return (
    <NativeTabs
      tintColor={COLORS.primary.DEFAULT}
      labelStyle={{ fontSize: SIZES.tabBar.labelSize, fontWeight: '600' }}
    >
      <NativeTabs.Trigger name="index" hidden={hidden('index')}>
        <NativeTabs.Trigger.Label>{TEXTS.tabs.dashboard}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} src={TAB_ICONS.home} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="history" hidden={hidden('history')}>
        <NativeTabs.Trigger.Label>{TEXTS.tabs.history}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock.arrow.circlepath" src={TAB_ICONS.history} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="flosso" hidden={hidden('flosso')}>
        <NativeTabs.Trigger.Label hidden>{TEXTS.tabs.flosso}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={TAB_ICONS.logo} renderingMode="original" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="debts" hidden={hidden('debts')}>
        <NativeTabs.Trigger.Label>{TEXTS.tabs.debts}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'calendar', selected: 'calendar.badge.clock' }}
          src={TAB_ICONS.calendar}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile" hidden={hidden('profile')}>
        <NativeTabs.Trigger.Label>{TEXTS.tabs.profile}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          src={TAB_ICONS.person}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
