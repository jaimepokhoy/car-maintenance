import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { FormScreen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { logExpense } from '@/db/expenses';
import type { Db } from '@/db/types';
import { getVehicle } from '@/db/vehicles';
import {
  toIsoDate,
  validateExpenseForm,
  type ExpenseCategory,
  type ExpenseFormError,
  type ExpenseFormValues,
  type Vehicle,
} from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useFormat } from '@/hooks/use-format';
import { refreshReminders } from '@/lib/reminders';

/** Categories the owner picks from; services have their own log. */
const CATEGORIES: readonly ExpenseCategory[] = [
  'fuel',
  'insurance',
  'registration',
  'repairs',
  'tires',
  'parking',
  'tolls',
  'wash',
  'other',
];

export default function AddExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback((db: Db) => getVehicle(db, id), [id]);
  const { data: vehicle } = useDbQuery(load);

  if (!vehicle) return <ThemedView style={styles.flex} />;
  return <ExpenseForm vehicle={vehicle} />;
}

function ExpenseForm({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const format = useFormat();
  const today = toIsoDate(new Date());
  const [values, setValues] = useState<ExpenseFormValues>({
    category: 'fuel',
    incurredOn: today,
    amount: '',
    odometerKm: format.distanceInput(vehicle.odometerKm),
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ExpenseFormValues, ExpenseFormError>>>({});
  const [saving, setSaving] = useState(false);

  const errorFor = (field: keyof ExpenseFormValues) =>
    errors[field] ? t(`expenses.errors.${errors[field]}`) : undefined;
  const set = (field: 'amount' | 'odometerKm' | 'notes') => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));

  async function save() {
    const result = validateExpenseForm(values, today, format.distanceUnit);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    await logExpense(db, { id: randomUUID(), vehicleId: vehicle.id, currency: 'CAD', ...result.value }, new Date());
    refreshReminders(db);
    router.back();
  }

  return (
    <FormScreen footer={<Button title={t('expenses.save')} size="large" onPress={save} loading={saving} />}>
      <ThemedText type="small" themeColor="textSecondary">
        {vehicle.nickname}
      </ThemedText>

      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary" accessibilityRole="header">
          {t('expenses.category')}
        </ThemedText>
        <View style={styles.chips}>
          {CATEGORIES.map((category) => (
            <Chip
              key={category}
              role="radio"
              label={t(`expenseCategories.${category}`)}
              selected={values.category === category}
              onPress={() => setValues((current) => ({ ...current, category }))}
            />
          ))}
        </View>
      </View>

      <View style={styles.columns}>
        <View style={styles.flex}>
          <TextField
            label={t('expenses.amount')}
            value={values.amount}
            onChangeText={set('amount')}
            keyboardType="decimal-pad"
            prefix="$"
            placeholder="0.00"
            autoFocus
            error={errorFor('amount')}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label={t('expenses.odometer')}
            value={values.odometerKm}
            onChangeText={set('odometerKm')}
            keyboardType="number-pad"
            suffix={format.distanceUnit}
            hint={t('serviceForm.odometerHint')}
            error={errorFor('odometerKm')}
          />
        </View>
      </View>

      <DateField
        label={t('expenses.date')}
        value={values.incurredOn}
        maximum={today}
        onChange={(incurredOn) => setValues((current) => ({ ...current, incurredOn }))}
        error={errorFor('incurredOn')}
      />

      <TextField
        label={t('expenses.notes')}
        placeholder={t('expenses.notesPlaceholder')}
        value={values.notes}
        onChangeText={set('notes')}
        multiline
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  field: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + Spacing.half,
  },
});
