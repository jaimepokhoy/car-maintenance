import { Link, router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card, CardRow } from '@/components/card';
import { DueStatusRow, useDueDetail } from '@/components/due-status-row';
import { Gauge } from '@/components/gauge';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SectionLabel } from '@/components/screen';
import { SegmentedControl } from '@/components/segmented-control';
import { useDueStateColors } from '@/components/status-pill';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardGlow } from '@/components/vehicle-art';
import { Spacing } from '@/constants/theme';
import { getTenantNames } from '@/db/customer-links';
import { deleteServiceRecord, listServiceRecords } from '@/db/service-records';
import { shopNames } from '@/db/shops';
import type { Db } from '@/db/types';
import { getVehicle, updateTireSet } from '@/db/vehicles';
import {
  computeVehicleDueStatuses,
  daysBetween,
  describeDuration,
  describeVehicle,
  intervalProgress,
  nextTireReminder,
  remainingLimits,
  resolveSchedule,
  serviceRecordPermissions,
  TIRE_SETS,
  summarizeCosts,
  toIsoDate,
  type DueStatus,
  type ServiceRecord,
  type TireSet,
} from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useDeleteVehicle } from '@/hooks/use-delete-vehicle';
import { useDoneToday } from '@/hooks/use-done-today';
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
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const confirmDelete = useDeleteVehicle();
  const doneToday = useDoneToday();
  const load = useCallback(
    async (db: Db) => {
      const vehicle = await getVehicle(db, id);
      if (!vehicle) {
        return { vehicle: null, statuses: [], records: [], shops: new Map<string, string>(), tenants: new Map() };
      }
      const records = await listServiceRecords(db, id);
      const statuses = computeVehicleDueStatuses(
        resolveSchedule(vehicle.powertrain),
        vehicle,
        records,
        toIsoDate(new Date()),
      );
      return { vehicle, statuses, records, shops: await shopNames(db), tenants: await getTenantNames(db) };
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
  const urgent = statuses.find((s) => s.state === 'overdue' || s.state === 'due_soon');

  async function changeTires(tireSet: TireSet) {
    await updateTireSet(db, vehicle.id, tireSet, new Date());
    refreshReminders(db);
    reload();
  }

  const tireReminder =
    province && vehicle.tireSet ? nextTireReminder(toIsoDate(new Date()), province, vehicle.tireSet) : null;
  const odometerDays = daysBetween(vehicle.odometerUpdatedOn, toIsoDate(new Date()));
  const odometerAge =
    odometerDays <= 0
      ? t('vehicle.updatedToday')
      : (() => {
          const age = describeDuration(odometerDays);
          return t('vehicle.updatedAgo', { ago: t(`duration.${age.unit}`, { count: age.count }) });
        })();

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

  const openGuide = (status: DueStatus) =>
    router.push({
      pathname: '/guide/[item]',
      params: { item: status.itemId, powertrain: vehicle.powertrain, id: vehicle.id },
    });
  const openNotes = (record: ServiceRecord) =>
    router.push({ pathname: '/vehicles/[id]/notes', params: { id: vehicle.id, record: record.id } });
  const openLog = (status?: DueStatus) =>
    router.push({ pathname: '/vehicles/[id]/log', params: { id: vehicle.id, item: status?.itemId } });

  return (
    <ThemedView style={styles.flex}>
      <Stack.Screen
        options={{
          title: vehicle.nickname,
          headerRight: () => (
            <Link href={{ pathname: '/vehicles/[id]/edit', params: { id: vehicle.id } }} asChild>
              <IconButton icon="edit" accessibilityLabel={t('vehicle.edit')} />
            </Link>
          ),
        }}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {describeVehicle(vehicle)}
        </ThemedText>

        <Hero status={urgent} nextUp={statuses.find((s) => s.state === 'ok')} tracked={statuses.some((s) => s.state !== 'unknown')} />

        <View style={styles.actions}>
          {urgent ? (
            <Button
              title={t('vehicle.doneToday')}
              size="large"
              icon={<Icon name="check" size={20} color={theme.onAccent} weight="bold" />}
              style={styles.flex}
              onPress={async () => {
                await doneToday(vehicle, urgent.itemId);
                reload();
              }}
            />
          ) : (
            <Button title={t('vehicle.logService')} size="large" style={styles.flex} onPress={() => openLog()} />
          )}
          {urgent ? (
            <IconButton
              icon="list"
              variant="outlined"
              size={56}
              accessibilityLabel={t('vehicle.logService')}
              onPress={() => openLog(urgent)}
            />
          ) : null}
        </View>

        <Card style={styles.between}>
          <View>
            <ThemedText type="label" themeColor="textSecondary">
              {`${t('vehicle.odometer')} · ${odometerAge}`}
            </ThemedText>
            <ThemedText type="numeral">{format.distance(vehicle.odometerKm)}</ThemedText>
          </View>
          <Link href={{ pathname: '/vehicles/[id]/odometer', params: { id: vehicle.id } }} asChild>
            <Button title={t('vehicle.update')} variant="secondary" size="small" />
          </Link>
        </Card>

        <Card>
          <SegmentedControl
            label={t('tires.label')}
            value={vehicle.tireSet ?? ('' as TireSet)}
            onChange={changeTires}
            options={TIRE_SETS.map((set) => ({ value: set, label: t(`tires.${set}`) }))}
          />
          {tireReminder ? (
            <ThemedText type="small" themeColor="warningText">
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
        </Card>

        <SectionLabel>{t('vehicle.maintenance')}</SectionLabel>
        <Card variant="list">
          {statuses.map((status, index) => (
            <CardRow key={status.itemId} last={index === statuses.length - 1}>
              <DueStatusRow
                status={status}
                emphasis="quiet"
                onDoneToday={async () => {
                  await doneToday(vehicle, status.itemId);
                  reload();
                }}
                onLearnMore={() => openGuide(status)}
                onLog={() => openLog(status)}
              />
            </CardRow>
          ))}
        </Card>

        <SectionLabel
          trailing={
            costs.pricedCount > 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('vehicle.thisYear', { amount: format.money(costs.thisYearCents, 'CAD') })}
              </ThemedText>
            ) : null
          }>
          {t('vehicle.history')}
        </SectionLabel>
        <Card variant="list">
          {records.length === 0 ? (
            <CardRow last style={styles.emptyRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('vehicle.noHistory')}
              </ThemedText>
            </CardRow>
          ) : (
            records.map((record, index) => (
              <Pressable
                key={record.id}
                accessibilityRole="button"
                {...(serviceRecordPermissions(record).delete
                  ? {
                      accessibilityHint: t('vehicle.deleteServiceTitle'),
                      onLongPress: () => confirmDeleteService(record),
                    }
                  : {
                      // The shop's record of the work stays as logged; only the customer's notes change.
                      accessibilityHint: t('vehicle.editNotesHint'),
                      onPress: () => openNotes(record),
                    })}>
                <CardRow last={index === records.length - 1}>
                  <View style={styles.flex}>
                    <ThemedText type="bodyStrong">
                      {record.itemIds.map((itemId) => t(`items.${itemId}`)).join(', ')}
                    </ThemedText>
                    {record.createdByTenantId ? (
                      <View style={styles.badge}>
                        <Icon name="shop" size={12} color={theme.accent} />
                        <ThemedText type="caption" themeColor="accent" numberOfLines={1}>
                          {t('vehicle.loggedBy', {
                            shop: data.tenants.get(record.createdByTenantId) ?? t('sharing.unknownShop'),
                          })}
                        </ThemedText>
                      </View>
                    ) : null}
                    <ThemedText type="caption" themeColor="textSecondary">
                      {[
                        format.date(record.performedOn),
                        format.distance(record.odometerKm),
                        record.shopId ? data.shops.get(record.shopId) : undefined,
                        record.notes,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </ThemedText>
                  </View>
                  {record.costCents !== undefined ? (
                    <ThemedText type="numeralCompact">{format.money(record.costCents, record.currency)}</ThemedText>
                  ) : null}
                </CardRow>
              </Pressable>
            ))
          )}
        </Card>

        {costs.pricedCount > 0 ? (
          <Card style={styles.grid}>
            {(
              [
                ['costs.thisYear', costs.thisYearCents],
                ['costs.last12Months', costs.last12MonthsCents],
                ['costs.monthlyAverage', costs.monthlyAverageCents],
                ['costs.allTime', costs.totalCents],
              ] as const
            ).map(([label, cents]) => (
              <View key={label} style={styles.cell}>
                <ThemedText type="label" themeColor="textSecondary">
                  {t(label)}
                </ThemedText>
                <ThemedText type="numeralCompact">{format.money(cents, 'CAD')}</ThemedText>
              </View>
            ))}
            {costs.unpricedCount > 0 ? (
              <ThemedText type="caption" themeColor="textSecondary" style={styles.span}>
                {t('costs.unpriced', { count: costs.unpricedCount })}
              </ThemedText>
            ) : null}
          </Card>
        ) : null}

        {vehicle.licencePlate || vehicle.tireSize ? (
          <Card style={styles.grid}>
            {vehicle.licencePlate ? (
              <View style={styles.cell}>
                <ThemedText type="label" themeColor="textSecondary">
                  {t('vehicleForm.licencePlate')}
                </ThemedText>
                <ThemedText type="bodyStrong">{vehicle.licencePlate}</ThemedText>
              </View>
            ) : null}
            {vehicle.tireSize ? (
              <View style={styles.cell}>
                <ThemedText type="label" themeColor="textSecondary">
                  {t('vehicleForm.tireSize')}
                </ThemedText>
                <ThemedText type="bodyStrong">{vehicle.tireSize}</ThemedText>
              </View>
            ) : null}
          </Card>
        ) : null}

        <Button
          title={t('vehicle.delete')}
          variant="destructive"
          onPress={() => confirmDelete(vehicle, () => router.back())}
          style={styles.delete}
        />
      </ScrollView>
    </ThemedView>
  );
}

/** The instrument: the most urgent item at display scale, or a calm all-clear. */
function Hero({ status, nextUp, tracked }: { status?: DueStatus; nextUp?: DueStatus; tracked: boolean }) {
  const { t } = useTranslation();
  const format = useFormat();
  const colors = useDueStateColors(status?.state ?? (tracked ? 'ok' : 'unknown'));
  const detail = useDueDetail();

  if (!status) {
    return (
      <View style={styles.hero}>
        <Gauge progress={nextUp ? intervalProgress(nextUp) ?? 0 : 0} color={colors.mark} size={230} stroke={12}>
          <ThemedText type="label" style={{ color: colors.text }}>
            {t(tracked ? 'garage.allClear' : 'dueState.unknown')}
          </ThemedText>
          <ThemedText type="headline" style={styles.center}>
            {t(tracked ? 'vehicle.nothingDue' : 'vehicle.nothingTracked')}
          </ThemedText>
        </Gauge>
        {nextUp ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {t('vehicle.nextUp', { item: t(`items.${nextUp.itemId}`), when: detail(nextUp) })}
          </ThemedText>
        ) : null}
      </View>
    );
  }

  const [limit] = remainingLimits(status);
  let figure = '';
  let unit = '';
  if (limit?.kind === 'km') {
    figure = format.distance(Math.abs(limit.value)).replace(/\s*\D+$/, '');
    unit = t(limit.value < 0 ? 'due.unitOverdue' : 'due.unitRemaining', { unit: format.distanceUnit });
  } else if (limit) {
    const duration = describeDuration(limit.value);
    figure = String(duration.count);
    unit = t(limit.value < 0 ? 'due.unitOverdue' : 'due.unitRemaining', {
      unit: t(`duration.${duration.unit}Unit`, { count: duration.count }),
    });
  }

  return (
    <View style={styles.hero} accessibilityRole="summary" accessibilityLabel={`${t(`items.${status.itemId}`)}: ${detail(status)}`}>
      <CardGlow from="top" color={colors.mark} />
      <Gauge progress={intervalProgress(status) ?? 1} color={colors.mark}>
        <ThemedText type="label" style={[styles.center, { color: colors.text }]} numberOfLines={2}>
          {t(`items.${status.itemId}`)}
        </ThemedText>
        <ThemedText type="numeralLarge" style={styles.figure} adjustsFontSizeToFit numberOfLines={1}>
          {figure}
        </ThemedText>
        <ThemedText type="label" themeColor="textSecondary" style={styles.center}>
          {unit}
        </ThemedText>
      </Gauge>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
    marginHorizontal: -Spacing.gutter,
  },
  figure: {
    marginVertical: -Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.half,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyRow: {
    paddingVertical: Spacing.three,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.three,
  },
  cell: {
    width: '50%',
    gap: Spacing.half,
  },
  span: {
    width: '100%',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  delete: {
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
});
