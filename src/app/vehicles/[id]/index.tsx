import { randomUUID } from 'expo-crypto';
import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { DueStatusRow } from '@/components/due-status-row';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { deleteServiceRecord, listServiceRecords, logService } from '@/db/service-records';
import { shopNames } from '@/db/shops';
import type { Db } from '@/db/types';
import { deleteVehicle, getVehicle, updateTireSet } from '@/db/vehicles';
import {
  computeVehicleDueStatuses,
  nextTireReminder,
  resolveSchedule,
  TIRE_SETS,
  summarizeCosts,
  toIsoDate,
  type MaintenanceItemId,
  type ServiceRecord,
  type TireSet,
} from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useFormat } from '@/hooks/use-format';
import { usePreferences } from '@/hooks/use-preferences';
import { useTheme } from '@/hooks/use-theme';
import { refreshReminders } from '@/lib/reminders';

export default function VehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const format = useFormat();
  const { province } = usePreferences().preferences;
  const theme = useTheme();
  const db = useSQLiteContext();
  const load = useCallback(
    async (db: Db) => {
      const vehicle = await getVehicle(db, id);
      if (!vehicle) return { vehicle: null, statuses: [], records: [], shops: new Map<string, string>() };
      const records = await listServiceRecords(db, id);
      const statuses = computeVehicleDueStatuses(
        resolveSchedule(vehicle.powertrain),
        vehicle,
        records,
        toIsoDate(new Date()),
      );
      return { vehicle, statuses, records, shops: await shopNames(db) };
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
  const costs = summarizeCosts(records, toIsoDate(new Date()));

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

  async function changeTires(tireSet: TireSet) {
    await updateTireSet(db, vehicle.id, tireSet, new Date());
    refreshReminders(db);
    reload();
  }

  const tireReminder =
    province && vehicle.tireSet ? nextTireReminder(toIsoDate(new Date()), province, vehicle.tireSet) : null;

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
              {`${t('vehicle.odometer')}: ${format.distance(vehicle.odometerKm)}`}
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

        <ThemedView type="backgroundElement" style={styles.card}>
          <SegmentedControl
            label={t('tires.label')}
            value={vehicle.tireSet ?? ('' as TireSet)}
            onChange={changeTires}
            options={TIRE_SETS.map((set) => ({ value: set, label: t(`tires.${set}`) }))}
          />
          {tireReminder ? (
            <ThemedText type="small" themeColor="textSecondary">
              {[
                t(`tires.${tireReminder.action}`, { date: format.date(tireReminder.remindOn) }),
                tireReminder.legalDeadline && tireReminder.action === 'install_winter'
                  ? t('tires.legal', { date: format.date(tireReminder.legalDeadline) })
                  : null,
              ]
                .filter(Boolean)
                .join(' ')}
            </ThemedText>
          ) : vehicle.tireSet && !province ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t('tires.setProvince')}
            </ThemedText>
          ) : null}
        </ThemedView>

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

        {costs.pricedCount > 0 ? (
          <>
            <ThemedText type="smallBold" accessibilityRole="header">
              {t('costs.title')}
            </ThemedText>
            <ThemedView type="backgroundElement" style={styles.card}>
              {(
                [
                  ['costs.thisYear', costs.thisYearCents],
                  ['costs.last12Months', costs.last12MonthsCents],
                  ['costs.monthlyAverage', costs.monthlyAverageCents],
                  ['costs.allTime', costs.totalCents],
                ] as const
              ).map(([label, cents]) => (
                <View key={label} style={styles.row}>
                  <ThemedText type="small">{t(label)}</ThemedText>
                  <ThemedText type="smallBold">{format.money(cents, 'CAD')}</ThemedText>
                </View>
              ))}
              {costs.unpricedCount > 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('costs.unpriced', { count: costs.unpricedCount })}
                </ThemedText>
              ) : null}
            </ThemedView>
          </>
        ) : null}

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
                  <ThemedText type="smallBold">{format.date(record.performedOn)}</ThemedText>
                  {record.costCents !== undefined ? (
                    <ThemedText type="small">
                      {format.money(record.costCents, record.currency)}
                    </ThemedText>
                  ) : null}
                </View>
                <ThemedText type="small">
                  {record.itemIds.map((itemId) => t(`items.${itemId}`)).join(', ')}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {[
                    format.distance(record.odometerKm),
                    record.shopId ? data.shops.get(record.shopId) : undefined,
                    record.notes,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
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
