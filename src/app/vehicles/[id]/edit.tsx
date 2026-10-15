import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedView } from '@/components/themed-view';
import { VehicleForm } from '@/components/vehicle-form';
import { Spacing } from '@/constants/theme';
import type { Db } from '@/db/types';
import { getVehicle, updateVehicleDetails } from '@/db/vehicles';
import { validateVehicleDetails, vehicleToFormValues, type Vehicle, type VehicleFormValues } from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useDeleteVehicle } from '@/hooks/use-delete-vehicle';
import { useFormat } from '@/hooks/use-format';
import { refreshReminders } from '@/lib/reminders';

export default function EditVehicleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback((db: Db) => getVehicle(db, id), [id]);
  const { data: vehicle } = useDbQuery(load);

  if (!vehicle) return <ThemedView style={styles.flex} />;
  return <EditVehicleForm vehicle={vehicle} />;
}

function EditVehicleForm({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const format = useFormat();
  const confirmDelete = useDeleteVehicle();

  async function save(values: VehicleFormValues) {
    const result = validateVehicleDetails(values, new Date().getFullYear());
    if (!result.ok) return result.errors;
    await updateVehicleDetails(db, vehicle.id, result.value, new Date());
    // A powertrain change swaps the maintenance schedule.
    refreshReminders(db);
    router.back();
  }

  return (
    <VehicleForm
      initialValues={vehicleToFormValues(vehicle, format.distanceUnit)}
      showOdometer={false}
      submitTitle={t('vehicleForm.saveChanges')}
      onSubmit={save}
      footer={
        <Button
          title={t('vehicle.delete')}
          variant="destructive"
          size="small"
          onPress={() => confirmDelete(vehicle, () => router.dismissTo('/'))}
          style={styles.delete}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  delete: {
    alignSelf: 'center',
    marginTop: Spacing.two + Spacing.half,
  },
});
