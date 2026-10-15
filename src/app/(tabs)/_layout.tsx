import { Tabs } from 'expo-router/js-tabs';
import { useTranslation } from 'react-i18next';

import { Icon, type IconName } from '@/components/icon';
import { TabBar } from '@/components/tab-bar';
import { useTheme } from '@/hooks/use-theme';

const TABS: { name: string; label: 'tabs.garage' | 'tabs.shops' | 'tabs.settings'; icon: IconName }[] = [
  { name: 'index', label: 'tabs.garage', icon: 'car' },
  { name: 'shops', label: 'tabs.shops', icon: 'pin' },
  { name: 'settings', label: 'tabs.settings', icon: 'settings' },
];

export default function TabLayout() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.background } }}>
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.label),
            tabBarIcon: ({ color }) => <Icon name={tab.icon} size={22} color={String(color)} />,
          }}
        />
      ))}
    </Tabs>
  );
}
