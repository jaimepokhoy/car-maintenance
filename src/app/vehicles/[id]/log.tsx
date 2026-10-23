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
import { listServiceRecords, logService } from '@/db/service-records';
import { listSavedShops } from '@/db/shops';
import type { Db } from '@/db/types';
import { getVehicle } from '@/db/vehicles';
import {
  addDays,
  resolveSchedule,
  toIsoDate,
  validateServiceForm,
  type MaintenanceItemId,
  type ServiceFormError,
  type ServiceFormValues,
  type ServiceRecord,
  type Vehicle,
} from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useFormat } from '@/hooks/use-format';
import { refreshReminders } from '@/lib/reminders';

export default function LogServiceScreen() {
  const { id, item } = useLocalSearchParams<{ id: string; item?: MaintenanceItemId }>();
  const load = useCallback(
    async (db: Db) => {
      const vehicle = await getVehicle(db, id);
      return vehicle ? { vehicle, records: await listServiceRecords(db, id) } : null;
    },
    [id],
  );
  const { data } = useDbQuery(load);

  if (!data) return <ThemedView style={styles.flex} />;
  return <LogServiceForm vehicle={data.vehicle} records={data.records} initialItem={item} />;
}

function LogServiceForm({
  vehicle,
  records,
  initialItem,
}: {
  vehicle: Vehicle;
  records: ServiceRecord[];
  initialItem?: MaintenanceItemId;
}) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const format = useFormat();
  const today = toIsoDate(new Date());
  const yesterday = addDays(today, -1);
  const [values, setValues] = useState<ServiceFormValues>({
    itemIds: initialItem ? [initialItem] : [],
    performedOn: today,
    odometerKm: format.distanceInput(vehicle.odometerKm),
    cost: '',
    notes: '',
  });
  const [pickingDate, setPickingDate] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ServiceFormValues, ServiceFormError>>>({});
  const [saving, setSaving] = useState(false);
  const [shopId, setShopId] = useState<string | undefined>();
  const { data: shops = [] } = useDbQuery(listSavedShops);

  const errorFor = (field: keyof ServiceFormValues) =>
    errors[field] ? t(`serviceForm.errors.${errors[field]}`) : undefined;
  const set = (field: 'odometerKm' | 'cost' | 'notes') => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  const setDate = (performedOn: string) => setValues((current) => ({ ...current, performedOn }));
  const toggle = (itemId: MaintenanceItemId) =>
    setValues((current) => ({
      ...current,
      itemIds: current.itemIds.includes(itemId)
        ? current.itemIds.filter((id) => id !== itemId)
        : [...current.itemIds, itemId],
    }));

  // The latest priced service with exactly this set of items (records arrive newest first), for the "same as last" shortcut.
  const selection = [...values.itemIds].sort().join(',');
  const lastCost = values.itemIds.length
    ? records.find((record) => record.costCents !== undefined && [...record.itemIds].sort().join(',') === selection)
        ?.costCents
    : undefined;
  const showPicker = pickingDate || (values.performedOn !== today && values.performedOn !== yesterday);

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
    <FormScreen footer={<Button title={t('serviceForm.save')} size="large" onPress={save} loading={saving} />}>
      <ThemedText type="small" themeColor="textSecondary">
        {vehicle.nickname}
      </ThemedText>

      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary" accessibilityRole="header">
          {t('serviceForm.items')}
        </ThemedText>
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
          <ThemedText type="caption" themeColor="dangerText" accessibilityLiveRegion="polite">
            {errorFor('itemIds')}
          </ThemedText>
        ) : null}
      </View>

      <View style={styles.field}>
        <ThemedText type="label" themeColor="textSecondary" accessibilityRole="header">
          {t('serviceForm.date')}
        </ThemedText>
        <View style={styles.chips}>
          <Chip
            role="radio"
            label={t('serviceForm.today')}
            selected={!showPicker && values.performedOn === today}
            onPress={() => {
              setPickingDate(false);
              setDate(today);
            }}
          />
          <Chip
            role="radio"
            label={t('serviceForm.yesterday')}
            selected={!showPicker && values.performedOn === yesterday}
            onPress={() => {
              setPickingDate(false);
              setDate(yesterday);
            }}
          />
          <Chip role="radio" label={t('serviceForm.pickDate')} selected={showPicker} onPress={() => setPickingDate(true)} />
        </View>
        {showPicker ? (
          <DateField
            label={t('serviceForm.pickedDate')}
            value={values.performedOn}
            maximum={today}
            onChange={setDate}
            error={errorFor('performedOn')}
          />
        ) : null}
      </View>

      <View style={styles.columns}>
        <View style={styles.flex}>
          <TextField
            label={t('serviceForm.odometer')}
            value={values.odometerKm}
            onChangeText={set('odometerKm')}
            keyboardType="number-pad"
            suffix={format.distanceUnit}
            hint={values.odometerKm === format.distanceInput(vehicle.odometerKm) ? t('serviceForm.odometerHint') : undefined}
            error={errorFor('odometerKm')}
          />
        </View>
        <View style={styles.flex}>
          <TextField
            label={t('serviceForm.cost')}
            value={values.cost}
            onChangeText={set('cost')}
            keyboardType="decimal-pad"
            prefix="$"
            placeholder="0.00"
            error={errorFor('cost')}
          />
          {lastCost !== undefined ? (
            <View style={styles.sameAsLast}>
              <Chip
                label={t('serviceForm.sameAsLast', { amount: format.money(lastCost) })}
                selected={values.cost === (lastCost / 100).toFixed(2)}
                onPress={() => set('cost')((lastCost / 100).toFixed(2))}
              />
            </View>
          ) : null}
        </View>
      </View>

      {shops.length > 0 ? (
        <View style={styles.field}>
          <ThemedText type="label" themeColor="textSecondary" accessibilityRole="header">
            {t('serviceForm.shop')}
          </ThemedText>
          <View style={styles.chips}>
            <Chip
              role="radio"
              label={t('serviceForm.noShop')}
              selected={shopId === undefined}
              onPress={() => setShopId(undefined)}
            />
            {shops.map((shop) => (
              <Chip
                key={shop.id}
                role="radio"
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
  sameAsLast: {
    flexDirection: 'row',
    marginTop: Spacing.two,
  },
});
