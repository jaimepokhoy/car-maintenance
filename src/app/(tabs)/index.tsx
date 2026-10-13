import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { useDueStateColor } from '@/components/due-status-row';
import { Screen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listServiceRecords } from '@/db/service-records';
import type { Db } from '@/db/types';
import { listVehicles } from '@/db/vehicles';
import {
  computeVehicleDueStatuses,
  describeVehicle,
  resolveSchedule,
  toIsoDate,
  type DueStatus,
  type Vehicle,
} from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useDeleteVehicle } from '@/hooks/use-delete-vehicle';
import { useFormat } from '@/hooks/use-format';

interface GarageEntry {
  vehicle: Vehicle;
  next?: DueStatus;
}

async function loadGarage(db: Db): Promise<GarageEntry[]> {
  const today = toIsoDate(new Date());
  const vehicles = await listVehicles(db);
  return Promise.all(
    vehicles.map(async (vehicle) => {
      const records = await listServiceRecords(db, vehicle.id);
      const statuses = computeVehicleDueStatuses(resolveSchedule(vehicle.powertrain), vehicle, records, today);
      return { vehicle, next: statuses.find((s) => s.state === 'overdue' || s.state === 'due_soon') };
    }),
  );
}

export default function GarageScreen() {
  const { t } = useTranslation();
  const { data: garage, reload } = useDbQuery(loadGarage);

  return (
    <Screen title={t('garage.title')}>
      {garage?.length === 0 ? (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{t('garage.emptyTitle')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('garage.emptyBody')}
          </ThemedText>
        </ThemedView>
      ) : null}
      {garage?.map((entry) => <VehicleCard key={entry.vehicle.id} entry={entry} onDeleted={reload} />)}
      <Link href="/vehicles/new" asChild>
        <Button title={t('garage.add')} />
      </Link>
    </Screen>
  );
}

function VehicleCard({ entry: { vehicle, next }, onDeleted }: { entry: GarageEntry; onDeleted: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const nextColor = useDueStateColor(next?.state ?? 'ok');
  const confirmDelete = useDeleteVehicle();

  function showActions() {
    Alert.alert(vehicle.nickname, undefined, [
      {
        text: t('vehicle.edit'),
        onPress: () => router.push({ pathname: '/vehicles/[id]/edit', params: { id: vehicle.id } }),
      },
      { text: t('vehicle.delete'), style: 'destructive', onPress: () => confirmDelete(vehicle, onDeleted) },
      { text: t('vehicle.cancel'), style: 'cancel' },
    ]);
  }

  return (
    <Link href={{ pathname: '/vehicles/[id]', params: { id: vehicle.id } }} asChild>
      <Pressable accessibilityRole="button" accessibilityHint={t('garage.actionsHint')} onLongPress={showActions}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{vehicle.nickname}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {`${describeVehicle(vehicle)} · ${t('garage.odometer', {
              distance: format.distance(vehicle.odometerKm),
            })}`}
          </ThemedText>
          <ThemedText type="small" style={{ color: nextColor }}>
            {next
              ? t('garage.nextUp', {
                  item: t(`items.${next.itemId}`),
                  state: t(`dueState.${next.state}`).toLowerCase(),
                })
              : t('garage.allClear')}
          </ThemedText>
        </ThemedView>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.one,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
});
