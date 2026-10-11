import '@/i18n';

import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';

import { migrate } from '@/db/migrations';
import { useColorScheme } from '@/hooks/use-color-scheme';

SplashScreen.preventAutoHideAsync();

async function initDatabase(db: Parameters<typeof migrate>[0]) {
  await migrate(db);
  SplashScreen.hideAsync();
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <SQLiteProvider databaseName="car-maintenance.db" onInit={initDatabase}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="vehicles/new"
            options={{ presentation: 'modal', title: t('vehicleForm.title') }}
          />
          <Stack.Screen name="vehicles/[id]/index" options={{ title: '' }} />
          <Stack.Screen
            name="vehicles/[id]/log"
            options={{ presentation: 'modal', title: t('serviceForm.title') }}
          />
          <Stack.Screen
            name="vehicles/[id]/odometer"
            options={{ presentation: 'modal', title: t('odometerForm.title') }}
          />
          <Stack.Screen name="guide/[item]" options={{ presentation: 'modal', title: '' }} />
        </Stack>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
