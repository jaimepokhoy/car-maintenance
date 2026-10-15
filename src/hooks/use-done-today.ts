import { randomUUID } from 'expo-crypto';
import { useSQLiteContext } from 'expo-sqlite';
import { LayoutAnimation, type LayoutAnimationConfig } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { logService } from '@/db/service-records';
import { toIsoDate, type MaintenanceItemId, type Vehicle } from '@/domain';
import { refreshReminders } from '@/lib/reminders';

/** The row collapses and the status pill changes in place; a crossfade when the owner prefers less motion. */
const COLLAPSE: LayoutAnimationConfig = {
  duration: 220,
  create: { type: 'easeInEaseOut', property: 'opacity' },
  update: { type: 'easeInEaseOut' },
  delete: { type: 'easeInEaseOut', property: 'opacity' },
};
const CROSSFADE: LayoutAnimationConfig = {
  duration: 150,
  create: { type: 'linear', property: 'opacity' },
  update: { type: 'linear', property: 'opacity' },
  delete: { type: 'linear', property: 'opacity' },
};

/**
 * Logs one item as done today at the vehicle's current odometer, the one-tap
 * path, and animates the next layout pass so the caller's `reload()` lands
 * as a collapse rather than a jump.
 */
export function useDoneToday() {
  const db = useSQLiteContext();
  const reducedMotion = useReducedMotion();

  return async (vehicle: Pick<Vehicle, 'id' | 'odometerKm'>, itemId: MaintenanceItemId) => {
    const now = new Date();
    await logService(
      db,
      {
        id: randomUUID(),
        vehicleId: vehicle.id,
        itemIds: [itemId],
        performedOn: toIsoDate(now),
        odometerKm: vehicle.odometerKm,
      },
      now,
    );
    refreshReminders(db);
    LayoutAnimation.configureNext(reducedMotion ? CROSSFADE : COLLAPSE);
  };
}
