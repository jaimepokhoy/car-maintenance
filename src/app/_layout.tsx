import '@/i18n';

import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Platform } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontAssets, Fonts } from '@/constants/theme';
import { migrate } from '@/db/migrations';
import { notificationTarget } from '@/domain';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { PreferencesProvider } from '@/hooks/use-preferences';
import { SessionProvider } from '@/hooks/use-session';
import { SyncProvider } from '@/hooks/use-sync';
import { TenantProvider } from '@/hooks/use-tenant';
import { useTheme } from '@/hooks/use-theme';
import { configureNotifications, refreshReminders } from '@/lib/reminders';

SplashScreen.preventAutoHideAsync();
configureNotifications();

// Web (testing only): one page at a time can hold the database file, and a refresh
// can start before the old page lets go. A failed open can't be retried in place,
// so reload a few times; a second open tab still surfaces the error.
const LOCK_RETRIES = 'db-lock-retries';

function retryIfLocked(error: Error) {
  if (Platform.OS !== 'web' || !error.message.includes('createSyncAccessHandle')) throw error;
  const tries = Number(sessionStorage.getItem(LOCK_RETRIES) ?? 0);
  if (tries >= 3) throw error;
  sessionStorage.setItem(LOCK_RETRIES, String(tries + 1));
  setTimeout(() => location.reload(), 500);
}

async function init(db: SQLiteDatabase) {
  if (Platform.OS === 'web') sessionStorage.removeItem(LOCK_RETRIES);
  await migrate(db);
}

export default function RootLayout() {
  return (
    <SQLiteProvider
      databaseName="car-maintenance.db"
      options={{ enableChangeListener: true }}
      onInit={init}
      onError={retryIfLocked}>
      <PreferencesProvider>
        <TenantProvider>
          <SessionProvider>
            <SyncProvider>
              <AppShell />
            </SyncProvider>
          </SessionProvider>
        </TenantProvider>
      </PreferencesProvider>
    </SQLiteProvider>
  );
}

/** Theme, fonts and the navigation stack, all of which depend on the owner's stored preferences. */
function AppShell() {
  const scheme = useColorScheme();
  const colors = useTheme();
  const { t } = useTranslation();
  const [fontsLoaded, fontError] = useFonts(FontAssets);

  useEffect(() => {
    // The database is open by the time this renders; wait only for the fonts.
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
    fonts: {
      regular: { fontFamily: Fonts.body, fontWeight: '400' as const },
      medium: { fontFamily: Fonts.bodyMedium, fontWeight: '500' as const },
      bold: { fontFamily: Fonts.bodySemiBold, fontWeight: '600' as const },
      heavy: { fontFamily: Fonts.display, fontWeight: '800' as const },
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      {/* Mounted with the navigator so a tapped reminder never pushes before the router exists. */}
      {Platform.OS !== 'web' && <ReminderSync />}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerStyle: { backgroundColor: colors.background },
          headerTitle: ({ children }) => (
            <ThemedText type="headline" numberOfLines={1} accessibilityRole="header">
              {children}
            </ThemedText>
          ),
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="vehicles/new" options={{ presentation: 'modal', title: t('vehicleForm.title') }} />
        <Stack.Screen name="vehicles/[id]/index" options={{ title: '' }} />
        <Stack.Screen name="vehicles/[id]/log" options={{ presentation: 'modal', title: t('serviceForm.title') }} />
        <Stack.Screen name="vehicles/[id]/edit" options={{ presentation: 'modal', title: t('vehicleForm.editTitle') }} />
        <Stack.Screen
          name="vehicles/[id]/odometer"
          options={{ presentation: 'modal', title: t('odometerForm.title') }}
        />
        <Stack.Screen name="guide/[item]" options={{ presentation: 'modal', title: '' }} />
        <Stack.Screen name="sign-in" options={{ presentation: 'modal', title: t('auth.title') }} />
        <Stack.Screen name="auth-callback" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}

/**
 * Reschedules reminders when the app comes to the foreground, and opens the screen a tapped
 * reminder points to (or the home tab for a shop's message).
 */
function ReminderSync() {
  const db = useSQLiteContext();

  useEffect(() => {
    refreshReminders(db);
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshReminders(db);
    });

    function open(response: Notifications.NotificationResponse | null) {
      const target = notificationTarget(response?.notification.request.content.data);
      if (target === '/') router.navigate('/');
      else if (target) router.push(target as Parameters<typeof router.push>[0]);
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
