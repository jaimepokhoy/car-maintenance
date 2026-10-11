import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { DueStatusRow } from '@/components/due-status-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listServiceRecords } from '@/db/service-records';
import type { Db } from '@/db/types';
import { deleteVehicle, getVehicle } from '@/db/vehicles';
import { computeVehicleDueStatuses, formatDistance, resolveSchedule, toIsoDate } from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useLocale } from '@/hooks/use-locale';
import { useTheme } from '@/hooks/use-theme';

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const locale = useLocale();
  const theme = useTheme();
  const db = useSQLiteContext();

  const load = useCallback(
    async (db: Db) => {
      const vehicle = await getVehicle(db, id);
      if (!vehicle) return { vehicle: null, statuses: [] };
      const records = await listServiceRecords(db, id);
      const statuses = computeVehicleDueStatuses(
        resolveSchedule(vehicle.powertrain),
        vehicle,
        records,
        toIsoDate(new Date()),
      );
      return { vehicle, statuses };
    },
    [id],
  );
  const data = useDbQuery(load);

  if (!data) return <ThemedView style={styles.flex} />;
  if (!data.vehicle) {
    return (
      <ThemedView style={[styles.flex, styles.content]}>
        <ThemedText>{t('vehicle.notFound')}</ThemedText>
      </ThemedView>
    );
  }

  const { vehicle, statuses } = data;

  function confirmDelete() {
    Alert.alert(t('vehicle.deleteConfirmTitle'), t('vehicle.deleteConfirmBody'), [
      { text: t('vehicle.cancel'), style: 'cancel' },
      {
        text: t('vehicle.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteVehicle(db, vehicle.id, new Date());
          router.back();
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen options={{ title: vehicle.nickname }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            {`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
          </ThemedText>
          <ThemedText type="small">
            {`${t('vehicle.odometer')}: ${formatDistance(vehicle.odometerKm, 'km', locale)}`}
          </ThemedText>
        </ThemedView>

        <ThemedText type="smallBold" accessibilityRole="header">
          {t('vehicle.maintenance')}
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          {statuses.map((status) => (
            <DueStatusRow key={status.itemId} status={status} />
          ))}
        </ThemedView>

        <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.delete}>
          <ThemedText type="small" style={{ color: theme.danger }}>
            {t('vehicle.delete')}
          </ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.four,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Spacing.four,
  },
  delete: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
});
