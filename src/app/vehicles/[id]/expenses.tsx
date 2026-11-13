import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card, CardRow } from '@/components/card';
import { Icon } from '@/components/icon';
import { FormScreen, SectionLabel } from '@/components/screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { deleteExpense, listExpenses } from '@/db/expenses';
import { listServiceRecords } from '@/db/service-records';
import type { Db } from '@/db/types';
import { getVehicle } from '@/db/vehicles';
import { summarizeSpend, toIsoDate, type Expense } from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useFormat } from '@/hooks/use-format';

export default function ExpensesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const format = useFormat();
  const db = useSQLiteContext();
  const load = useCallback(
    async (db: Db) => {
      const vehicle = await getVehicle(db, id);
      if (!vehicle) return null;
      const [records, expenses] = await Promise.all([listServiceRecords(db, id), listExpenses(db, id)]);
      return { vehicle, records, expenses, spend: summarizeSpend(records, expenses, toIsoDate(new Date())) };
    },
    [id],
  );
  const { data, reload } = useDbQuery(load);

  if (!data) return <ThemedView style={styles.flex} />;
  const { vehicle, expenses, spend } = data;

  function confirmDeleteExpense(expense: Expense) {
    Alert.alert(t('expenses.deleteTitle'), undefined, [
      { text: t('vehicle.cancel'), style: 'cancel' },
      {
        text: t('expenses.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteExpense(db, expense.id, new Date());
          reload();
        },
      },
    ]);
  }

  const totals = [
    ['expenses.thisYear', spend.thisYearCents],
    ['expenses.last12Months', spend.last12MonthsCents],
    ['expenses.monthlyAverage', spend.monthlyAverageCents],
    ['expenses.allTime', spend.totalCents],
  ] as const;

  return (
    <FormScreen
      footer={
        <Button
          title={t('expenses.add')}
          size="large"
          icon={<Icon name="add" size={20} color={undefined} weight="bold" />}
          onPress={() => router.push({ pathname: '/vehicles/[id]/expense', params: { id: vehicle.id } })}
        />
      }>
      <Stack.Screen options={{ title: t('expenses.title') }} />
      <ThemedText type="small" themeColor="textSecondary">
        {vehicle.nickname}
      </ThemedText>

      <Card>
        <ThemedText type="label" themeColor="textSecondary">
          {t('expenses.total')}
        </ThemedText>
        <ThemedText type="numeralLarge">{format.money(spend.totalCents, 'CAD')}</ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {t('expenses.combinedHint')}
        </ThemedText>
      </Card>

      <Card style={styles.grid}>
        {totals.map(([label, cents]) => (
          <View key={label} style={styles.cell}>
            <ThemedText type="label" themeColor="textSecondary">
              {t(label)}
            </ThemedText>
            <ThemedText type="numeralCompact">{format.money(cents, 'CAD')}</ThemedText>
          </View>
        ))}
        {spend.unpricedCount > 0 ? (
          <ThemedText type="caption" themeColor="textSecondary" style={styles.span}>
            {t('costs.unpriced', { count: spend.unpricedCount })}
          </ThemedText>
        ) : null}
      </Card>

      {spend.byCategory.length > 0 ? (
        <>
          <SectionLabel>{t('expenses.byCategory')}</SectionLabel>
          <Card variant="list">
            {spend.byCategory.map((entry, index) => (
              <CardRow key={entry.category} last={index === spend.byCategory.length - 1}>
                <View style={styles.flex}>
                  <ThemedText type="bodyStrong">{t(`expenseCategories.${entry.category}`)}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {t('expenses.count', { count: entry.count })}
                  </ThemedText>
                </View>
                <ThemedText type="numeralCompact">{format.money(entry.cents, 'CAD')}</ThemedText>
              </CardRow>
            ))}
          </Card>
        </>
      ) : null}

      <SectionLabel>{t('expenses.logged')}</SectionLabel>
      <Card variant="list">
        {expenses.length === 0 ? (
          <CardRow last style={styles.emptyRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('expenses.empty')}
            </ThemedText>
          </CardRow>
        ) : (
          expenses.map((expense, index) => (
            <Pressable
              key={expense.id}
              accessibilityRole="button"
              accessibilityHint={t('expenses.deleteTitle')}
              onLongPress={() => confirmDeleteExpense(expense)}>
              <CardRow last={index === expenses.length - 1}>
                <View style={styles.flex}>
                  <ThemedText type="bodyStrong">{t(`expenseCategories.${expense.category}`)}</ThemedText>
                  <ThemedText type="caption" themeColor="textSecondary">
                    {[format.date(expense.incurredOn), expense.notes].filter(Boolean).join(' · ')}
                  </ThemedText>
                </View>
                <ThemedText type="numeralCompact">{format.money(expense.amountCents, expense.currency)}</ThemedText>
              </CardRow>
            </Pressable>
          ))
        )}
      </Card>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
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
  emptyRow: {
    paddingVertical: Spacing.three,
  },
});
