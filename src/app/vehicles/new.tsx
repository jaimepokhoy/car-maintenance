import { randomUUID } from 'expo-crypto';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useTranslation } from 'react-i18next';

import { EMPTY_VEHICLE_FORM, VehicleForm } from '@/components/vehicle-form';
import { insertVehicle } from '@/db/vehicles';
import { toIsoDate, validateVehicleForm, type VehicleFormValues } from '@/domain';
import { useFormat } from '@/hooks/use-format';
import { refreshReminders, requestReminderPermission } from '@/lib/reminders';

export default function NewVehicleScreen() {
  const { t } = useTranslation();
  const db = useSQLiteContext();
  const format = useFormat();

  async function save(values: VehicleFormValues) {
    const now = new Date();
    const result = validateVehicleForm(values, now.getFullYear(), format.distanceUnit);
    if (!result.ok) return result.errors;
    const id = randomUUID();
    await insertVehicle(db, id, result.value, now, toIsoDate(now));
    requestReminderPermission().then(() => refreshReminders(db));
    router.dismiss();
    router.push({ pathname: '/vehicles/[id]', params: { id } });
  }

  return (
    <VehicleForm
      initialValues={EMPTY_VEHICLE_FORM}
      showOdometer
      submitTitle={t('vehicleForm.save')}
      onSubmit={save}
    />
  );
}
