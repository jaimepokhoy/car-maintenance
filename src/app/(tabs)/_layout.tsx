import { Tabs } from "expo-router/js-tabs";
import { useTranslation } from "react-i18next";

import { Icon, type IconName } from "@/components/icon";
import { TabBar } from "@/components/tab-bar";
import { useSaveTenantShop } from "@/hooks/use-tenant-shop";
import { useTheme } from "@/hooks/use-theme";
import { isBrandedBuild } from "@/lib/tenant-config";

const TABS: {
  name: string;
  label: "tabs.garage" | "tabs.shops" | "tabs.yourShop" | "tabs.settings";
  icon: IconName;
}[] = [
  { name: "index", label: "tabs.garage", icon: "car" },
  // A shop's own app shows that shop instead of the nearby finder.
  isBrandedBuild
    ? { name: "shops", label: "tabs.yourShop", icon: "shop" }
    : { name: "shops", label: "tabs.shops", icon: "pin" },
  { name: "settings", label: "tabs.settings", icon: "settings" },
];

export default function TabLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  useSaveTenantShop();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: t(tab.label),
            tabBarIcon: ({ color }) => (
              <Icon name={tab.icon} size={22} color={String(color)} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
