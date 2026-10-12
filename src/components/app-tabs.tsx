import { NativeTabs } from 'expo-router/unstable-native-tabs';
import type { AndroidSymbol } from 'expo-symbols';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors } from '@/constants/theme';

const TABS: { name: string; label: 'tabs.garage' | 'tabs.shops' | 'tabs.settings'; sf: SFSymbol; material: AndroidSymbol }[] = [
  { name: 'index', label: 'tabs.garage', sf: 'car.fill', material: 'directions_car' },
  { name: 'shops', label: 'tabs.shops', sf: 'wrench.and.screwdriver.fill', material: 'car_repair' },
  { name: 'settings', label: 'tabs.settings', sf: 'gearshape.fill', material: 'settings' },
];

export default function AppTabs() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'unspecified' ? 'light' : scheme];

  return (
    <NativeTabs
      backgroundColor={colors.background}
      indicatorColor={colors.backgroundElement}
      labelStyle={{ selected: { color: colors.text } }}>
      {TABS.map((tab) => (
        <NativeTabs.Trigger key={tab.name} name={tab.name}>
          <NativeTabs.Trigger.Label>{t(tab.label)}</NativeTabs.Trigger.Label>
          <NativeTabs.Trigger.Icon sf={tab.sf} md={tab.material} />
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}
