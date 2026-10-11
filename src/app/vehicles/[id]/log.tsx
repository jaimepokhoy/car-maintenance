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
import { listSavedShops } from '@/db/shops';
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
import { useFormat } from '@/hooks/use-format';
import { refreshReminders } from '@/lib/reminders';

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
  const format = useFormat();
  const today = toIsoDate(new Date());
  const [values, setValues] = useState<ServiceFormValues>({
    itemIds: initialItem ? [initialItem] : [],
    performedOn: today,
    odometerKm: format.distanceInput(vehicle.odometerKm),
    cost: '',
    notes: '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof ServiceFormValues, ServiceFormError>>>({});
  const [saving, setSaving] = useState(false);
  const [shopId, setShopId] = useState<string | undefined>();
  const { data: shops = [] } = useDbQuery(listSavedShops);

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
    const result = validateServiceForm(values, today, format.distanceUnit);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    await logService(
      db,
      { id: randomUUID(), vehicleId: vehicle.id, currency: 'CAD', shopId, ...result.value },
      new Date(),
    );
    refreshReminders(db);
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
            label={t('serviceForm.odometer', { unit: format.distanceUnit })}
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
          {shops.length > 0 ? (
            <View style={styles.field}>
              <ThemedText type="small">{t('serviceForm.shop')}</ThemedText>
              <View style={styles.chips}>
                <Chip
                  label={t('serviceForm.noShop')}
                  selected={shopId === undefined}
                  onPress={() => setShopId(undefined)}
                />
                {shops.map((shop) => (
                  <Chip
                    key={shop.id}
                    label={shop.name}
                    selected={shopId === shop.id}
                    onPress={() => setShopId(shop.id)}
                  />
                ))}
              </View>
            </View>
          ) : null}
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
