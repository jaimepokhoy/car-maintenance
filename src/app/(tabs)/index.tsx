import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, CardRow } from '@/components/card';
import { DueStatusRow } from '@/components/due-status-row';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Screen, SectionLabel } from '@/components/screen';
import { StatusPill } from '@/components/status-pill';
import { ThemedText } from '@/components/themed-text';
import { CardGlow, CarSilhouette } from '@/components/vehicle-art';
import { Control, Spacing } from '@/constants/theme';
import { listServiceRecords } from '@/db/service-records';
import type { Db } from '@/db/types';
import { listVehicles } from '@/db/vehicles';
import {
  compareDueStatuses,
  computeVehicleDueStatuses,
  describeVehicle,
  resolveSchedule,
  toIsoDate,
  type DueStatus,
  type Vehicle,
} from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useDeleteVehicle } from '@/hooks/use-delete-vehicle';
import { useDoneToday } from '@/hooks/use-done-today';
import { useFormat } from '@/hooks/use-format';
import { useTheme } from '@/hooks/use-theme';

interface GarageEntry {
  vehicle: Vehicle;
  statuses: DueStatus[];
}

async function loadGarage(db: Db): Promise<GarageEntry[]> {
  const today = toIsoDate(new Date());
  const vehicles = await listVehicles(db);
  return Promise.all(
    vehicles.map(async (vehicle) => {
      const records = await listServiceRecords(db, vehicle.id);
      const statuses = computeVehicleDueStatuses(resolveSchedule(vehicle.powertrain), vehicle, records, today);
      return { vehicle, statuses };
    }),
  );
}

export default function GarageScreen() {
  const { t } = useTranslation();
  const { data: garage, reload } = useDbQuery(loadGarage);
  const doneToday = useDoneToday();

  // Everything that needs attention, across every car, most urgent first.
  const attention = (garage ?? [])
    .flatMap((entry) =>
      entry.statuses
        .filter((status) => status.state === 'overdue' || status.state === 'due_soon')
        .map((status) => ({ entry, status })),
    )
    .sort((a, b) => compareDueStatuses(a.status, b.status));

  return (
    <Screen
      title={t('garage.title')}
      action={
        garage?.length ? (
          <Link href="/vehicles/new" asChild>
            <IconButton icon="add" variant="outlined" accessibilityLabel={t('garage.add')} />
          </Link>
        ) : null
      }>
      {garage?.length === 0 ? <EmptyGarage /> : null}
      {garage?.map((entry) => <VehicleCard key={entry.vehicle.id} entry={entry} onDeleted={reload} />)}

      {attention.length > 0 ? (
        <>
          <SectionLabel>{t('garage.upNext')}</SectionLabel>
          <Card variant="list">
            {attention.map(({ entry, status }, index) => (
              <CardRow key={`${entry.vehicle.id}-${status.itemId}`} last={index === attention.length - 1}>
                <View style={styles.flex}>
                  {garage && garage.length > 1 ? (
                    <ThemedText type="caption" themeColor="textSecondary" style={styles.rowVehicle}>
                      {entry.vehicle.nickname}
                    </ThemedText>
                  ) : null}
                  <DueStatusRow
                    status={status}
                    onDoneToday={async () => {
                      await doneToday(entry.vehicle, status.itemId);
                      reload();
                    }}
                    onLog={() =>
                      router.push({
                        pathname: '/vehicles/[id]/log',
                        params: { id: entry.vehicle.id, item: status.itemId },
                      })
                    }
                    onLearnMore={() =>
                      router.push({
                        pathname: '/guide/[item]',
                        params: { item: status.itemId, powertrain: entry.vehicle.powertrain, id: entry.vehicle.id },
                      })
                    }
                  />
                </View>
              </CardRow>
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

function EmptyGarage() {
  const { t } = useTranslation();
  const theme = useTheme();
  const benefits: { icon: IconName; key: 'garage.benefitReminders' | 'garage.benefitHistory' | 'garage.benefitGuide' }[] = [
    { icon: 'bell', key: 'garage.benefitReminders' },
    { icon: 'receipt', key: 'garage.benefitHistory' },
    { icon: 'book', key: 'garage.benefitGuide' },
  ];

  return (
    <>
      <Card variant="hero" style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceRaised }]}>
          <Icon name="carOutline" size={40} color={theme.textSecondary} weight="regular" />
        </View>
        <View style={styles.emptyText}>
          <ThemedText type="headline" accessibilityRole="header">
            {t('garage.emptyTitle')}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {t('garage.emptyBody')}
          </ThemedText>
        </View>
        <Link href="/vehicles/new" asChild>
          <Button title={t('garage.add')} size="large" style={styles.stretch} />
        </Link>
      </Card>
      <View style={styles.benefits}>
        {benefits.map((benefit) => (
          <View key={benefit.key} style={styles.benefit}>
            <View style={[styles.benefitIcon, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <Icon name={benefit.icon} size={18} color={theme.text} />
            </View>
            <ThemedText type="small" style={styles.flex}>
              {t(benefit.key)}
            </ThemedText>
          </View>
        ))}
      </View>
    </>
  );
}

function VehicleCard({ entry: { vehicle, statuses }, onDeleted }: { entry: GarageEntry; onDeleted: () => void }) {
  const { t } = useTranslation();
  const format = useFormat();
  const theme = useTheme();
  const confirmDelete = useDeleteVehicle();
  const overdue = statuses.filter((s) => s.state === 'overdue').length;
  const dueSoon = statuses.some((s) => s.state === 'due_soon');
  const nothingLogged = statuses.every((s) => s.state === 'unknown');

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
      <Pressable
        accessibilityRole="button"
        accessibilityHint={t('garage.actionsHint')}
        onLongPress={showActions}
        style={({ pressed }) => pressed && { opacity: 0.85 }}>
        <Card variant="hero">
          <CardGlow />
          <View style={styles.cardTop}>
            <View style={styles.flex}>
              <ThemedText type="display">{vehicle.nickname}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {`${describeVehicle(vehicle)} · ${t(`powertrain.${vehicle.powertrain}`)}`}
              </ThemedText>
            </View>
            {overdue > 0 ? (
              <StatusPill state="overdue" label={t('garage.overdueCount', { count: overdue })} />
            ) : dueSoon ? (
              <StatusPill state="due_soon" label={t('dueState.due_soon')} />
            ) : nothingLogged ? (
              <StatusPill state="unknown" label={t('dueState.unknown')} />
            ) : (
              <StatusPill state="ok" label={t('garage.allClear')} />
            )}
          </View>
          <CarSilhouette />
          <View style={styles.cardBottom}>
            <View>
              <ThemedText type="label" themeColor="textSecondary">
                {t('vehicle.odometer')}
              </ThemedText>
              <ThemedText type="numeral">{format.distance(vehicle.odometerKm)}</ThemedText>
            </View>
            <View style={[styles.chevron, { backgroundColor: theme.inverse }]} aria-hidden>
              <Icon name="forward" size={20} color={theme.onInverse} weight="bold" />
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  stretch: {
    alignSelf: 'stretch',
  },
  center: {
    textAlign: 'center',
  },
  rowVehicle: {
    marginBottom: Spacing.one,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + Spacing.one,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  chevron: {
    width: Control.touch,
    height: Control.touch,
    borderRadius: Control.touch / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.five,
    gap: Spacing.four,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  benefits: {
    gap: Spacing.two + Spacing.one,
    paddingHorizontal: Spacing.one,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
