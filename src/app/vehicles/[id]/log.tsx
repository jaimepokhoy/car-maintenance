import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Chip } from '@/components/chip';
import { DateField } from '@/components/date-field';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { logService } from '@/db/service-records';
import type { Db } from '@/db/types';
import { getVehicle } from '@/db/vehicles';
import {
  resolveSchedule,
  toIsoDate,
  validateServiceForm,
  type MaintenanceItemId,
  type ServiceFormError,
  type ServiceFormValues,
  type Vehicle,
} from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';

export default function LogServiceScreen() {
  const { id, item } = useLocalSearchParams<{ id: string; item?: MaintenanceItemId }>();
  const load = useCallback((db: Db) => getVehicle(db, id), [id]);
  const { data: vehicle } = useDbQuery(load);

  if (!vehicle) return <ThemedView style={styles.flex} />;
  return <LogServiceForm vehicle={vehicle} initialItem={item} />;
}

function LogServiceForm({ vehicle, initialItem }: { vehicle: Vehicle; initialItem?: MaintenanceItemId }) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const today = toIsoDate(new Date());
  const [values, setValues] = useState<ServiceFormValues>({
    itemIds: initialItem ? [initialItem] : [],
    performedOn: today,
    odometerKm: String(vehicle.odometerKm),
    cost: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ServiceFormValues, ServiceFormError>>>({});
  const [saving, setSaving] = useState(false);

  const errorFor = (field: keyof ServiceFormValues) =>
    errors[field] ? t(`serviceForm.errors.${errors[field]}`) : undefined;
  const set = (field: 'odometerKm' | 'cost' | 'notes') => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  const toggle = (itemId: MaintenanceItemId) =>
    setValues((current) => ({
      ...current,
      itemIds: current.itemIds.includes(itemId)
        ? current.itemIds.filter((id) => id !== itemId)
        : [...current.itemIds, itemId],
    }));

  async function save() {
    const result = validateServiceForm(values, today);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    await logService(
      db,
      { id: randomUUID(), vehicleId: vehicle.id, currency: 'CAD', ...result.value },
      new Date(),
    );
    router.back();
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ThemedView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <ThemedText type="small">{t('serviceForm.items')}</ThemedText>
            <View style={styles.chips}>
              {resolveSchedule(vehicle.powertrain).map(({ itemId }) => (
                <Chip
                  key={itemId}
                  label={t(`items.${itemId}`)}
                  selected={values.itemIds.includes(itemId)}
                  onPress={() => toggle(itemId)}
                />
              ))}
            </View>
            {errorFor('itemIds') ? (
              <ThemedText type="small" themeColor="danger">
                {errorFor('itemIds')}
              </ThemedText>
            ) : null}
          </View>
          <DateField
            label={t('serviceForm.date')}
            value={values.performedOn}
            maximum={today}
            onChange={(performedOn) => setValues((current) => ({ ...current, performedOn }))}
            error={errorFor('performedOn')}
          />
          <TextField
            label={t('serviceForm.odometer')}
            value={values.odometerKm}
            onChangeText={set('odometerKm')}
            keyboardType="number-pad"
            error={errorFor('odometerKm')}
          />
          <TextField
            label={t('serviceForm.cost')}
            value={values.cost}
            onChangeText={set('cost')}
            keyboardType="decimal-pad"
            error={errorFor('cost')}
          />
          <TextField
            label={t('serviceForm.notes')}
            placeholder={t('serviceForm.notesPlaceholder')}
            value={values.notes}
            onChangeText={set('notes')}
            multiline
          />
          <Button title={t('serviceForm.save')} onPress={save} disabled={saving} />
        </ScrollView>
      </ThemedView>
    </KeyboardAvoidingView>
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
  field: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
});
