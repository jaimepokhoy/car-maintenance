import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { listServiceRecords } from '@/db/service-records';
import { deleteVehicle } from '@/db/vehicles';
import type { Vehicle } from '@/domain';
import { refreshReminders } from '@/lib/reminders';

/** Asks before removing a vehicle, saying how much history goes with it, then calls `onDeleted`. */
export function useDeleteVehicle() {
  const { t } = useTranslation();
  const db = useSQLiteContext();

  return async (vehicle: Vehicle, onDeleted: () => void) => {
    const count = (await listServiceRecords(db, vehicle.id)).length;
    Alert.alert(
      t('vehicle.deleteConfirmTitle', { name: vehicle.nickname }),
      count > 0 ? t('vehicle.deleteConfirmBody', { count }) : t('vehicle.deleteConfirmBodyEmpty'),
      [
        { text: t('vehicle.cancel'), style: 'cancel' },
        {
          text: t('vehicle.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteVehicle(db, vehicle.id, new Date());
            refreshReminders(db);
            onDeleted();
          },
        },
      ],
    );
  };
}
