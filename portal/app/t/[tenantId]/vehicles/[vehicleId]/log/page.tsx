import { randomUUID } from 'node:crypto';

import Link from 'next/link';
import { redirect } from 'next/navigation';

import { canadianToday, effectiveOdometerKm, scheduleFor, vehicleLabel } from '@/lib/customers';
import { loadVehicle } from '@/lib/customers-data';
import { getMessages } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';

import { LogServiceForm } from './log-service-form';

type Props = { params: Promise<{ tenantId: string; vehicleId: string }> };

export default async function LogServicePage({ params }: Props) {
  const { tenantId, vehicleId } = await params;
  const { t } = await getMessages();
  const supabase = await createClient();
  if (!supabase) return <p role="alert">{t.common.notConfigured}</p>;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const detail = await loadVehicle(supabase, tenantId, vehicleId);
  if (!detail) {
    return (
      <>
        <Link href={`/t/${tenantId}/customers`}>{t.vehicle.back}</Link>
        <p role="alert">{t.vehicle.notFound}</p>
      </>
    );
  }

  const { vehicle, records, intervals } = detail;
  const items = scheduleFor(vehicle, intervals).map((interval) => ({
    id: interval.itemId,
    label: t.items[interval.itemId],
  }));

  return (
    <>
      <Link href={`/t/${tenantId}/vehicles/${vehicleId}`}>{vehicleLabel(vehicle)}</Link>
      <h1 style={{ marginTop: '0.75rem' }}>{t.logService.title}</h1>
      <p className="muted">{t.logService.intro}</p>
      <LogServiceForm
        tenantId={tenantId}
        vehicleId={vehicleId}
        recordId={randomUUID()}
        items={items}
        today={canadianToday()}
        odometerKm={effectiveOdometerKm(vehicle, records)}
        t={t.logService}
      />
    </>
  );
}
