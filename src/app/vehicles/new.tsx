import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { SegmentedControl } from '@/components/segmented-control';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { insertVehicle } from '@/db/vehicles';
import {
  isValidVin,
  normalizeVin,
  toIsoDate,
  validateVehicleForm,
  type Powertrain,
  type VehicleFormError,
  type VehicleFormValues,
} from '@/domain';
import { useFormat } from '@/hooks/use-format';
import { refreshReminders, requestReminderPermission } from '@/lib/reminders';
import { decodeVin } from '@/lib/vin-decode';

const EMPTY: VehicleFormValues = {
  nickname: '',
  year: '',
  make: '',
  model: '',
  vin: '',
  powertrain: 'gas',
  odometerKm: '',
};

export default function NewVehicleScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const format = useFormat();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof VehicleFormValues, VehicleFormError>>>({});
  const [saving, setSaving] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [decodeMessage, setDecodeMessage] = useState<
    'vehicleForm.decodeFilled' | 'vehicleForm.decodeNotFound' | 'vehicleForm.decodeFailed' | null
  >(null);
  const canDecode = isValidVin(normalizeVin(values.vin));

  const set = (field: keyof VehicleFormValues) => (value: string) =>
    setValues((current) => ({ ...current, [field]: value }));
  const errorFor = (field: keyof VehicleFormValues) =>
    errors[field] ? t(`vehicleForm.errors.${errors[field]}`) : undefined;

  async function fillFromVin() {
    setDecoding(true);
    setDecodeMessage(null);
    try {
      const decoded = await decodeVin(normalizeVin(values.vin));
      if (!decoded) {
        setDecodeMessage('vehicleForm.decodeNotFound');
        return;
      }
      setValues((current) => ({
        ...current,
        year: decoded.year ?? current.year,
        make: decoded.make ?? current.make,
        model: decoded.model ?? current.model,
        powertrain: decoded.powertrain ?? current.powertrain,
      }));
      setDecodeMessage('vehicleForm.decodeFilled');
    } catch (error) {
      console.warn('VIN lookup failed', error);
      setDecodeMessage('vehicleForm.decodeFailed');
    } finally {
      setDecoding(false);
    }
  }

  async function save() {
    const now = new Date();
    const result = validateVehicleForm(values, now.getFullYear(), format.distanceUnit);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setSaving(true);
    const id = randomUUID();
    await insertVehicle(db, id, result.value, now, toIsoDate(now));
    requestReminderPermission().then(() => refreshReminders(db));
    router.dismiss();
    router.push({ pathname: '/vehicles/[id]', params: { id } });
  }

  const powertrains: { value: Powertrain; label: string }[] = [
    { value: 'gas', label: t('powertrain.gas') },
    { value: 'hybrid', label: t('powertrain.hybrid') },
    { value: 'ev', label: t('powertrain.ev') },
  ];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ThemedView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextField
            label={t('vehicleForm.vin')}
            value={values.vin}
            onChangeText={set('vin')}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={20}
            error={errorFor('vin')}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {t('vehicleForm.vinHint')}
          </ThemedText>
          {canDecode ? (
            <Button
              title={decoding ? t('vehicleForm.decoding') : t('vehicleForm.decode')}
              onPress={fillFromVin}
              disabled={decoding}
            />
          ) : null}
          {decodeMessage ? (
            <ThemedText type="small" themeColor="textSecondary">
              {t(decodeMessage)}
            </ThemedText>
          ) : null}
          <TextField
            label={t('vehicleForm.year')}
            value={values.year}
            onChangeText={set('year')}
            keyboardType="number-pad"
            maxLength={4}
            error={errorFor('year')}
          />
          <TextField
            label={t('vehicleForm.make')}
            value={values.make}
            onChangeText={set('make')}
            autoCapitalize="words"
            error={errorFor('make')}
          />
          <TextField
            label={t('vehicleForm.model')}
            value={values.model}
            onChangeText={set('model')}
            autoCapitalize="words"
            error={errorFor('model')}
          />
          <SegmentedControl
            label={t('vehicleForm.powertrain')}
            options={powertrains}
            value={values.powertrain}
            onChange={(powertrain) => setValues((current) => ({ ...current, powertrain }))}
          />
          <TextField
            label={t('vehicleForm.odometer', { unit: format.distanceUnit })}
            value={values.odometerKm}
            onChangeText={set('odometerKm')}
            keyboardType="number-pad"
            error={errorFor('odometerKm')}
          />
          <TextField
            label={t('vehicleForm.nickname')}
            placeholder={t('vehicleForm.nicknamePlaceholder')}
            value={values.nickname}
            onChangeText={set('nickname')}
          />
          <Button title={t('vehicleForm.save')} onPress={save} disabled={saving} />
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
});
