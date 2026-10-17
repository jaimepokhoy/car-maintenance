import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { listServiceRecords } from '@/db/service-records';
import { getPreferences } from '@/db/settings';
import type { Db } from '@/db/types';
import { listVehicles } from '@/db/vehicles';
import {
  computeVehicleDueStatuses,
  formatDate,
  formatDistance,
  planReminders,
  resolveSchedule,
  toIsoDate,
  type DistanceUnit,
  type IsoDate,
  type PlannedReminder,
  type Vehicle,
} from '@/domain';
import i18n, { formattingLocale } from '@/i18n';

const CHANNEL_ID = 'maintenance-reminders';
const REMINDER_HOUR = 9;

/** Show reminders as banners even when the app is open. */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

/** Asks for permission once there's something worth reminding about. */
export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false; // Local notifications are native only.
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await Notifications.requestPermissionsAsync()).granted;
}

function atReminderTime(date: IsoDate): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day, REMINDER_HOUR);
}

function content(
  reminder: PlannedReminder,
  vehicle: Vehicle,
  unit: DistanceUnit,
): Notifications.NotificationContentInput {
  const t = i18n.t.bind(i18n);
  const locale = formattingLocale(i18n.language === 'fr' ? 'fr' : 'en');
  const url = `/vehicles/${vehicle.id}`;

  if (reminder.kind === 'odometer') {
    return {
      title: t('reminders.odometerTitle', { vehicle: vehicle.nickname }),
      body: t('reminders.odometerBody'),
      data: { url: `${url}/odometer` },
    };
  }

  if (reminder.kind === 'tires') {
    const { tires } = reminder;
    const install = tires.action === 'install_winter';
    return {
      title: t(install ? 'reminders.tiresInstallTitle' : 'reminders.tiresRemoveTitle', { vehicle: vehicle.nickname }),
      body:
        install && tires.legalDeadline
          ? t('reminders.tiresLegalBody', { date: formatDate(tires.legalDeadline, locale) })
          : t('reminders.tiresBody'),
      data: { url },
    };
  }

  const { status } = reminder;
  const limits = [
    status.dueOn ? formatDate(status.dueOn, locale) : null,
    status.dueAtKm !== undefined ? formatDistance(status.dueAtKm, unit, locale) : null,
  ]
    .filter(Boolean)
    .join(t('due.or'));
  const item = t(`items.${reminder.itemId}`);
  return {
    title: t(reminder.state === 'overdue' ? 'reminders.overdueTitle' : 'reminders.dueSoonTitle', { item }),
    body: `${vehicle.nickname}: ${t('due.dueBy', { limits })}`,
    data: { url },
  };
}

/**
 * Replaces every scheduled reminder with a fresh plan from the local data.
 * Cheap enough to run whenever the app opens or data changes.
 */
export async function syncReminders(db: Db): Promise<void> {
  if (Platform.OS === 'web' || !(await Notifications.getPermissionsAsync()).granted) return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: i18n.t('reminders.channelName'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const today = toIsoDate(new Date());
  const preferences = await getPreferences(db);
  const vehicles = await listVehicles(db);
  const inputs = await Promise.all(
    vehicles.map(async (vehicle) => {
      const records = await listServiceRecords(db, vehicle.id);
      const statuses = computeVehicleDueStatuses(resolveSchedule(vehicle.powertrain), vehicle, records, today);
      return { vehicle, statuses, records };
    }),
  );
  const byId = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]));

  await Notifications.cancelAllScheduledNotificationsAsync();
  for (const reminder of planReminders(inputs, today, preferences.province)) {
    await Notifications.scheduleNotificationAsync({
      content: content(reminder, byId.get(reminder.vehicleId)!, preferences.distanceUnit),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: atReminderTime(reminder.fireOn),
        channelId: CHANNEL_ID,
      },
    });
  }
}

/** Fire-and-forget refresh after a change; reminders must never block saving. */
export function refreshReminders(db: Db): void {
  syncReminders(db).catch((error) => console.warn('Could not schedule reminders', error));
}
