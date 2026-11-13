import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, CardRow } from '@/components/card';
import { Gauge } from '@/components/gauge';
import { FormScreen, SectionLabel } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { listExpenses } from '@/db/expenses';
import { listServiceRecords } from '@/db/service-records';
import type { Db } from '@/db/types';
import { getVehicle } from '@/db/vehicles';
import {
  computeVehicleDueStatuses,
  evaluateVehicle,
  resolveVehicleSchedule,
  toIsoDate,
  type CareGrade,
  type VehicleEvaluation,
} from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useFormat } from '@/hooks/use-format';
import { useTheme } from '@/hooks/use-theme';

export default function ReportCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const format = useFormat();
  const theme = useTheme();
  const load = useCallback(
    async (db: Db) => {
      const vehicle = await getVehicle(db, id);
      if (!vehicle) return null;
      const [records, expenses] = await Promise.all([listServiceRecords(db, id), listExpenses(db, id)]);
      const today = toIsoDate(new Date());
      const statuses = computeVehicleDueStatuses(resolveVehicleSchedule(vehicle), vehicle, records, today);
      return {
        vehicle,
        evaluation: evaluateVehicle(vehicle, statuses, records, expenses, today),
      };
    },
    [id],
  );
  const { data } = useDbQuery(load);

  if (!data) return <ThemedView style={styles.flex} />;
  const { vehicle, evaluation } = data;
  const gradeColors: Record<CareGrade, string> = {
    excellent: theme.success,
    good: theme.accent,
    fair: theme.warning,
    at_risk: theme.danger,
  };
  const color = evaluation.grade ? gradeColors[evaluation.grade] : theme.textSecondary;
  const { breakdown, spend } = evaluation;
  const advice = adviceKey(evaluation);

  return (
    <FormScreen
      footer={
        <Link href={{ pathname: '/vehicles/[id]/log', params: { id: vehicle.id } }} asChild>
          <Button title={t('vehicle.logService')} size="large" />
        </Link>
      }>
      <Stack.Screen options={{ title: t('report.title') }} />
      <View style={styles.intro}>
        <ThemedText type="small" themeColor="textSecondary">
          {vehicle.nickname}
        </ThemedText>
        <ThemedText type="display" accessibilityRole="header">
          {t('report.title')}
        </ThemedText>
      </View>

      {evaluation.score === null ? (
        <Card style={styles.empty}>
          <ThemedText type="headline">{t('report.noHistory')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('report.noHistoryBody')}</ThemedText>
        </Card>
      ) : (
        <>
          <View style={styles.hero}>
            <Gauge progress={evaluation.score / 100} color={color}>
              <ThemedText type="label" themeColor="textSecondary">
                {t('report.score')}
              </ThemedText>
              <ThemedText type="numeralLarge" style={{ color }}>
                {evaluation.score}
              </ThemedText>
              <ThemedText type="small" style={{ color }}>
                {evaluation.grade ? t(`report.grade.${evaluation.grade}`) : null}
              </ThemedText>
            </Gauge>
            <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
              {t('report.tracked', { tracked: breakdown.tracked, total: breakdown.total })}
            </ThemedText>
          </View>

          <SectionLabel>{t('report.maintenance')}</SectionLabel>
          <Card variant="list">
            {(
              [
                ['report.upToDate', breakdown.ok, theme.success],
                ['report.dueSoon', breakdown.dueSoon, theme.warning],
                ['report.overdue', breakdown.overdue, theme.danger],
                ['report.notLogged', breakdown.unknown, theme.textSecondary],
              ] as const
            ).map(([label, count, tint], index, all) => (
              <CardRow key={label} last={index === all.length - 1}>
                <View style={[styles.dot, { backgroundColor: tint }]} aria-hidden />
                <ThemedText style={styles.flex}>{t(label)}</ThemedText>
                <ThemedText type="numeralCompact">{count}</ThemedText>
              </CardRow>
            ))}
          </Card>

          <SectionLabel>{t('report.facts')}</SectionLabel>
          <Card style={styles.grid}>
            <Fact label={t('report.moneyIn')} value={format.money(spend.totalCents, 'CAD')} />
            <Fact
              label={t('report.perThousand')}
              value={
                evaluation.costPer1000KmCents === undefined
                  ? '–'
                  : `${format.money(evaluation.costPer1000KmCents, 'CAD')}/${format.distanceUnit}`
              }
            />
            <Fact label={t('report.last12Months')} value={format.money(spend.last12MonthsCents, 'CAD')} />
            <Fact label={t('report.services')} value={String(evaluation.servicesLogged)} />
            <Fact label={t('report.expenses')} value={String(evaluation.expensesLogged)} />
            <Fact
              label={t('report.odometerCovered')}
              value={evaluation.documentedKm === undefined ? '–' : format.distance(evaluation.documentedKm)}
            />
            {spend.unpricedCount > 0 ? (
              <ThemedText type="caption" themeColor="textSecondary" style={styles.span}>
                {t('costs.unpriced', { count: spend.unpricedCount })}
              </ThemedText>
            ) : null}
          </Card>

          <Card>
            <ThemedText type="bodyStrong" accessibilityRole="header">
              {t('report.whatMovesIt')}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t(advice, {
                item: evaluation.nextItemId ? t(`items.${evaluation.nextItemId}`) : '',
              })}
            </ThemedText>
          </Card>
        </>
      )}

      <ThemedText type="caption" themeColor="textSecondary" style={styles.center}>
        {t('report.disclaimer')}
      </ThemedText>
    </FormScreen>
  );
}

/** The one suggestion worth acting on, from the strongest signal in the data. */
function adviceKey(evaluation: VehicleEvaluation) {
  if (evaluation.breakdown.overdue > 0) return 'report.adviceOverdue' as const;
  if (evaluation.breakdown.dueSoon > 0) return 'report.adviceDueSoon' as const;
  if (evaluation.breakdown.unknown > 0) return 'report.adviceUnknown' as const;
  return 'report.adviceAllGood' as const;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <ThemedText type="label" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="numeralCompact">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  intro: {
    gap: Spacing.one,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  center: {
    textAlign: 'center',
  },
  empty: {
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
});
