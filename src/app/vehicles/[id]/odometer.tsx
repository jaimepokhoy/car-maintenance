import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { FormScreen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Db } from '@/db/types';
import { getVehicle, updateOdometer } from '@/db/vehicles';
import { displayToKm, parseWholeNumber, toIsoDate, type Vehicle } from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';
import { useFormat } from '@/hooks/use-format';
import { refreshReminders } from '@/lib/reminders';

const MAX_ODOMETER_KM = 2_000_000;

export default function OdometerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback((db: Db) => getVehicle(db, id), [id]);
  const { data: vehicle } = useDbQuery(load);

  if (!vehicle) return <ThemedView style={styles.flex} />;
  return <OdometerForm vehicle={vehicle} />;
}

function OdometerForm({ vehicle }: { vehicle: Vehicle }) {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const format = useFormat();
  const [value, setValue] = useState(format.distanceInput(vehicle.odometerKm));
  const [error, setError] = useState<'required' | 'invalidOdometer'>();

  async function save() {
    const entered = parseWholeNumber(value);
    const km = entered === null ? null : Math.round(displayToKm(entered, format.distanceUnit));
    if (!value.trim()) return setError('required');
    if (km === null || km > MAX_ODOMETER_KM) return setError('invalidOdometer');
    const now = new Date();
    await updateOdometer(db, vehicle.id, km, now, toIsoDate(now));
    refreshReminders(db);
    router.back();
  }

  return (
    <FormScreen footer={<Button title={t('odometerForm.save')} size="large" onPress={save} />}>
      <ThemedText type="small" themeColor="textSecondary">
        {vehicle.nickname}
      </ThemedText>
      <TextField
        label={t('odometerForm.current')}
        value={value}
        onChangeText={(next) => {
          setValue(next);
          setError(undefined);
        }}
        keyboardType="number-pad"
        size="large"
        suffix={format.distanceUnit}
        autoFocus
        selectTextOnFocus
        hint={t('odometerForm.hint')}
        error={error ? t(`odometerForm.errors.${error}`) : undefined}
      />
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
});
