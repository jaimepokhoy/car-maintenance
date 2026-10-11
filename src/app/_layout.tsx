import '@/i18n';

import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext } from 'expo-sqlite';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import { migrate } from '@/db/migrations';
import type { Db } from '@/db/types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { configureNotifications, refreshReminders } from '@/lib/reminders';

SplashScreen.preventAutoHideAsync();
configureNotifications();

async function initDatabase(db: Db) {
  await migrate(db);
  SplashScreen.hideAsync();
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <SQLiteProvider databaseName="car-maintenance.db" onInit={initDatabase}>
      <ReminderSync />
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

/** Reschedules reminders when the app comes to the foreground, and opens the screen a tapped reminder points to. */
function ReminderSync() {
  const db = useSQLiteContext();

  useEffect(() => {
    refreshReminders(db);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshReminders(db);
    });

    function open(response: Notifications.NotificationResponse | null) {
      const url = response?.notification.request.content.data?.url;
      if (typeof url === 'string') router.push(url as Parameters<typeof router.push>[0]);
    }
    Notifications.getLastNotificationResponseAsync().then(open);
    const tapped = Notifications.addNotificationResponseReceivedListener(open);

    return () => {
      appState.remove();
      tapped.remove();
    };
  }, [db]);

  return null;
}
