import { randomUUID } from 'expo-crypto';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DueStatusRow } from '@/components/due-status-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { deleteServiceRecord, listServiceRecords, logService } from '@/db/service-records';
import type { Db } from '@/db/types';
import { deleteVehicle, getVehicle } from '@/db/vehicles';
import {
  computeVehicleDueStatuses,
  formatDate,
  formatDistance,
  formatMoney,
  resolveSchedule,
  toIsoDate,
  type MaintenanceItemId,
  type ServiceRecord,
} from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useLocale } from '@/hooks/use-locale';
import { useTheme } from '@/hooks/use-theme';
import { refreshReminders } from '@/lib/reminders';

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const locale = useLocale();
  const theme = useTheme();
  const db = useSQLiteContext();
  const load = useCallback(
    async (db: Db) => {
      const vehicle = await getVehicle(db, id);
      if (!vehicle) return { vehicle: null, statuses: [], records: [] };
      const records = await listServiceRecords(db, id);
      const statuses = computeVehicleDueStatuses(
        resolveSchedule(vehicle.powertrain),
        vehicle,
        records,
        toIsoDate(new Date()),
      );
      return { vehicle, statuses, records };
    },
    [id],
  );
  const { data, reload } = useDbQuery(load);

  if (!data) return <ThemedView style={styles.flex} />;
  if (!data.vehicle) {
    return (
      <ThemedView style={[styles.flex, styles.content]}>
        <ThemedText>{t('vehicle.notFound')}</ThemedText>
      </ThemedView>
    );
  }

  const { vehicle, statuses, records } = data;

  async function doneToday(itemId: MaintenanceItemId) {
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
    reload();
  }

  function confirmDeleteService(record: ServiceRecord) {
    Alert.alert(t('vehicle.deleteServiceTitle'), undefined, [
      { text: t('vehicle.cancel'), style: 'cancel' },
      {
        text: t('vehicle.deleteService'),
        style: 'destructive',
        onPress: async () => {
          await deleteServiceRecord(db, record.id, new Date());
          refreshReminders(db);
          reload();
        },
      },
    ]);
  }

  function confirmDeleteVehicle() {
    Alert.alert(t('vehicle.deleteConfirmTitle'), t('vehicle.deleteConfirmBody'), [
      { text: t('vehicle.cancel'), style: 'cancel' },
      {
        text: t('vehicle.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteVehicle(db, vehicle.id, new Date());
          refreshReminders(db);
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
          <View style={styles.row}>
            <ThemedText type="small">
              {`${t('vehicle.odometer')}: ${formatDistance(vehicle.odometerKm, 'km', locale)}`}
            </ThemedText>
            <Link href={{ pathname: '/vehicles/[id]/odometer', params: { id: vehicle.id } }} asChild>
              <Pressable accessibilityRole="button" hitSlop={Spacing.two}>
                <ThemedText type="smallBold" style={{ color: theme.tint }}>
                  {t('vehicle.update')}
                </ThemedText>
              </Pressable>
            </Link>
          </View>
        </ThemedView>

        <Link href={{ pathname: '/vehicles/[id]/log', params: { id: vehicle.id } }} asChild>
          <Button title={t('vehicle.logService')} />
        </Link>

        <ThemedText type="smallBold" accessibilityRole="header">
          {t('vehicle.maintenance')}
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          {statuses.map((status) => (
            <DueStatusRow
              key={status.itemId}
              status={status}
              onDoneToday={() => doneToday(status.itemId)}
              onLearnMore={() =>
                router.push({
                  pathname: '/guide/[item]',
                  params: { item: status.itemId, powertrain: vehicle.powertrain },
                })
              }
              onLog={() =>
                router.push({
                  pathname: '/vehicles/[id]/log',
                  params: { id: vehicle.id, item: status.itemId },
                })
              }
            />
          ))}
        </ThemedView>

        <ThemedText type="smallBold" accessibilityRole="header">
          {t('vehicle.history')}
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.card}>
          {records.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('vehicle.noHistory')}
            </ThemedText>
          ) : (
            records.map((record) => (
              <Pressable
                key={record.id}
                accessibilityRole="button"
                accessibilityHint={t('vehicle.deleteServiceTitle')}
                onLongPress={() => confirmDeleteService(record)}
                style={styles.history}>
                <View style={styles.row}>
                  <ThemedText type="smallBold">{formatDate(record.performedOn, locale)}</ThemedText>
                  {record.costCents !== undefined ? (
                    <ThemedText type="small">
                      {formatMoney(record.costCents, record.currency ?? 'CAD', locale)}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText type="small">
                  {record.itemIds.map((itemId) => t(`items.${itemId}`)).join(', ')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[formatDistance(record.odometerKm, 'km', locale), record.notes].filter(Boolean).join(' · ')}
                </ThemedText>
              </Pressable>
            ))
          )}
        </ThemedView>

        <Pressable accessibilityRole="button" onPress={confirmDeleteVehicle} style={styles.delete}>
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
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  history: {
    gap: Spacing.half,
  },
  delete: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
});
