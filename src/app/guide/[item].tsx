import { router, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { useDueDetail } from '@/components/due-status-row';
import { Icon } from '@/components/icon';
import { FormScreen } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { useDueStateColors } from '@/components/status-pill';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listServiceRecords } from '@/db/service-records';
import type { Db } from '@/db/types';
import { getVehicle } from '@/db/vehicles';
import {
  computeDueStatus,
  GUIDANCE,
  resolveSchedule,
  toIsoDate,
  type DiyLevel,
  type MaintenanceItemId,
  type Powertrain,
} from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useFormat } from '@/hooks/use-format';
import { useTheme } from '@/hooks/use-theme';

/** How many of three bars the difficulty meter fills. */
const DIY_BARS: Record<DiyLevel, number> = { easy: 1, moderate: 2, shop: 3 };

export default function GuideScreen() {
  const {
    item,
    powertrain = 'gas',
    id,
  } = useLocalSearchParams<{ item: MaintenanceItemId; powertrain?: Powertrain; id?: string }>();
  const { t } = useTranslation();
  const format = useFormat();
  const theme = useTheme();
  const detail = useDueDetail();
  // When opened from a vehicle, show where that car stands on this item.
  const load = useCallback(
    async (db: Db) => {
      const vehicle = id ? await getVehicle(db, id) : null;
      if (!vehicle) return null;
      const owned = resolveSchedule(vehicle.powertrain).find((i) => i.itemId === item);
      if (!owned) return null;
      const records = await listServiceRecords(db, vehicle.id);
      return { vehicle, status: computeDueStatus(owned, vehicle, records, toIsoDate(new Date())) };
    },
    [id, item],
  );
  const { data: owned } = useDbQuery(load);
  const ownedColors = useDueStateColors(owned?.status.state ?? 'ok');
  const guidance = GUIDANCE[item];
  const interval = resolveSchedule(powertrain).find((i) => i.itemId === item);
  if (!guidance) return <ThemedView style={styles.flex} />;

  const limits = [
    interval?.everyKm !== undefined ? format.distance(interval.everyKm) : null,
    interval?.everyMonths !== undefined ? t('duration.month', { count: interval.everyMonths }) : null,
  ].filter((limit): limit is string => limit !== null);
  const [minCents, maxCents] = guidance.costCents;

  return (
    <FormScreen
      footer={
        <View style={styles.actions}>
          <Button
            title={t('guidance.findShop')}
            variant="secondary"
            size="large"
            icon={<Icon name="pin" size={18} color={theme.text} />}
            style={styles.flex}
            onPress={() => {
              router.dismiss();
              router.navigate('/shops');
            }}
          />
          {id ? (
            <Button
              title={t('guidance.logThis')}
              size="large"
              icon={<Icon name="check" size={18} color={theme.onAccent} weight="bold" />}
              style={styles.flex}
              onPress={() => {
                router.dismiss();
                router.push({ pathname: '/vehicles/[id]/log', params: { id, item } });
              }}
            />
          ) : null}
        </View>
      }>
        <View style={styles.intro}>
          <ThemedText type="display" accessibilityRole="header">
            {t(`items.${item}`)}
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary">
            {t(`guidance.items.${item}.what`)}
          </ThemedText>
        </View>

        <View style={styles.stats}>
          <Stat
            label={t('guidance.every')}
            value={limits[0] ?? '–'}
            detail={limits[1] ? t('guidance.orEvery', { limit: limits[1] }) : undefined}
          />
          <Stat
            label={t('guidance.shop')}
            value={format.moneyRange(minCents, maxCents, t('guidance.free'))}
            detail={t('guidance.typicalCost')}
          />
          <Stat label={t('guidance.diyLabel')} value={t(`guidance.diyLevel.${guidance.diy}`)}>
            <View
              style={styles.meter}
              accessibilityRole="progressbar"
              accessibilityLabel={t('guidance.difficulty', { level: DIY_BARS[guidance.diy], max: 3 })}
              accessibilityValue={{ min: 0, max: 3, now: DIY_BARS[guidance.diy] }}>
              {[1, 2, 3].map((bar) => (
                <View
                  key={bar}
                  style={[
                    styles.meterBar,
                    { backgroundColor: bar <= DIY_BARS[guidance.diy] ? theme.text : theme.surfaceRaised },
                  ]}
                />
              ))}
            </View>
          </Stat>
        </View>
        <ThemedText type="caption" themeColor="textSecondary">
          {t('guidance.disclaimer')}
        </ThemedText>

        {owned ? (
          <Card style={styles.owned}>
            <View style={[styles.ownedBar, { backgroundColor: ownedColors.mark }]} aria-hidden />
            <View style={styles.flex}>
              <ThemedText type="caption" themeColor="textSecondary">
                {[
                  t('guidance.forVehicle', { vehicle: owned.vehicle.nickname }),
                  owned.status.lastService
                    ? t('guidance.lastDone', { date: format.date(owned.status.lastService.performedOn) })
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
              <ThemedText
                type="smallStrong"
                style={{ color: owned.status.state === 'ok' ? theme.text : ownedColors.text }}>
                {owned.status.state === 'unknown' ? t('dueState.unknown') : detail(owned.status)}
              </ThemedText>
            </View>
          </Card>
        ) : null}

        <View style={[styles.section, { borderTopColor: theme.border }]}>
          <ThemedText type="headline" accessibilityRole="header">
            {t('guidance.whyItMatters')}
          </ThemedText>
          <ThemedText>{t(`guidance.items.${item}.why`)}</ThemedText>
        </View>
        <View style={[styles.section, { borderTopColor: theme.border }]}>
          <ThemedText type="headline" accessibilityRole="header">
            {t('guidance.doItYourself')}
          </ThemedText>
          <ThemedText>{t(`guidance.diy.${guidance.diy}`)}</ThemedText>
        </View>

    </FormScreen>
  );
}

function Stat({
  label,
  value,
  detail,
  children,
}: {
  label: string;
  value: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card style={styles.stat}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="numeralCompact" numberOfLines={2} adjustsFontSizeToFit>
        {value}
      </ThemedText>
      {detail ? (
        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={2}>
          {detail}
        </ThemedText>
      ) : null}
      {children}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  intro: {
    gap: Spacing.two,
    paddingBottom: Spacing.two,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    gap: Spacing.half,
    padding: Spacing.three - Spacing.one,
  },
  owned: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + Spacing.one,
  },
  ownedBar: {
    width: 4,
    height: 36,
    borderRadius: 2,
  },
  meter: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  meterBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  section: {
    gap: Spacing.two,
    paddingTop: Spacing.four - Spacing.one,
    marginTop: Spacing.one,
    borderTopWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two + Spacing.half,
  },
});
