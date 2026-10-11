import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { Db } from '@/db/types';
import { getVehicle, updateOdometer } from '@/db/vehicles';
import { parseWholeNumber, toIsoDate, type Vehicle } from '@/domain';
import { useDbQuery } from '@/hooks/use-db-query';

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
  const [value, setValue] = useState(String(vehicle.odometerKm));
  const [error, setError] = useState<'required' | 'invalidOdometer'>();

  async function save() {
    const km = parseWholeNumber(value);
    if (!value.trim()) return setError('required');
    if (km === null || km > MAX_ODOMETER_KM) return setError('invalidOdometer');
    const now = new Date();
    await updateOdometer(db, vehicle.id, km, now, toIsoDate(now));
    router.back();
  }

  return (
    <ThemedView style={[styles.flex, styles.content]}>
      <TextField
        label={t('odometerForm.current')}
        value={value}
        onChangeText={setValue}
        keyboardType="number-pad"
        autoFocus
        selectTextOnFocus
        error={error ? t(`odometerForm.errors.${error}`) : undefined}
      />
      <ThemedText type="small" themeColor="textSecondary">
        {t('odometerForm.hint')}
      </ThemedText>
      <Button title={t('odometerForm.save')} onPress={save} />
    </ThemedView>
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
});
