import Link from 'next/link';
import { redirect } from 'next/navigation';

import {
  canadianToday,
  effectiveOdometerKm,
  recordSource,
  sortHistory,
  vehicleDueStatuses,
  vehicleLabel,
} from '@/lib/customers';
import { loadVehicle } from '@/lib/customers-data';
import { type MaintenanceItemId, formatDate, formatDistance, formatMoney } from '@/lib/domain';
import { dueText } from '@/lib/due-text';
import { format, localeTag } from '@/lib/i18n/messages';
import { getMessages } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';

type Props = {
  params: Promise<{ tenantId: string; vehicleId: string }>;
  searchParams: Promise<{ logged?: string | string[] }>;
};

/** One customer vehicle: what is due and its service history, marking what this shop logged. */
export default async function VehiclePage({ params, searchParams }: Props) {
  const [{ tenantId, vehicleId }, { logged }] = await Promise.all([params, searchParams]);
  const { locale, t } = await getMessages();
  const supabase = await createClient();
  if (!supabase) return <p role="alert">{t.common.notConfigured}</p>;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const back = <Link href={`/t/${tenantId}/customers`}>{t.vehicle.back}</Link>;
  const detail = await loadVehicle(supabase, tenantId, vehicleId);
  if (!detail) {
    return (
      <>
        {back}
        <p role="alert">{t.vehicle.notFound}</p>
      </>
    );
  }

  const { vehicle, records, intervals } = detail;
  const tag = localeTag(locale);
  const statuses = vehicleDueStatuses(vehicle, records, intervals, canadianToday());
  const history = sortHistory(records);
  const itemNames = (ids: string[]) => ids.map((id) => t.items[id as MaintenanceItemId] ?? id).join(', ');
  const sourceLabel = {
    thisShop: t.vehicle.loggedByThisShop,
    otherShop: t.vehicle.loggedByOtherShop,
    customer: t.vehicle.loggedByCustomer,
  };

  return (
    <>
      {back}
      <div className="row spread" style={{ marginTop: '0.75rem' }}>
        <div>
          <h1>{vehicleLabel(vehicle)}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {[
              vehicle.nickname,
              vehicle.licence_plate && format(t.vehicle.plate, { plate: vehicle.licence_plate }),
              format(t.vehicle.odometer, { distance: formatDistance(effectiveOdometerKm(vehicle, records), 'km', tag) }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>
        <Link className="button" href={`/t/${tenantId}/vehicles/${vehicleId}/log`}>
          {t.vehicle.logService}
        </Link>
      </div>

      {logged !== undefined && (
        <p role="status" className="success">
          {t.vehicle.logged}
        </p>
      )}

      <section className="card" aria-labelledby="maintenance-heading">
        <h2 id="maintenance-heading">{t.vehicle.maintenance}</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">{t.vehicle.item}</th>
                <th scope="col">{t.vehicle.status}</th>
                <th scope="col">{t.vehicle.due}</th>
                <th scope="col">{t.vehicle.lastDone}</th>
              </tr>
            </thead>
            <tbody>
              {statuses.map((status) => (
                <tr key={status.itemId}>
                  <th scope="row">{t.items[status.itemId]}</th>
                  <td>
                    <span className={`chip chip-${status.state}`}>{t.due[status.state]}</span>
                  </td>
                  <td>{dueText(status, locale, t.due)}</td>
                  <td>
                    {status.lastService
                      ? `${formatDate(status.lastService.performedOn, tag)} · ${formatDistance(status.lastService.odometerKm, 'km', tag)}`
                      : t.vehicle.neverLogged}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card" aria-labelledby="history-heading">
        <h2 id="history-heading">{t.vehicle.history}</h2>
        {history.length === 0 ? (
          <p className="muted">{t.vehicle.noHistory}</p>
        ) : (
          <ol className="plain-list history">
            {history.map((record) => {
              const source = recordSource(record, tenantId);
              return (
                <li key={record.id}>
                  <div className="row spread">
                    <strong>{itemNames(record.item_ids)}</strong>
                    <span className={`chip chip-source-${source}`}>{sourceLabel[source]}</span>
                  </div>
                  <div className="muted">
                    {[
                      formatDate(record.performed_on, tag),
                      formatDistance(record.odometer_km, 'km', tag),
                      record.cost_cents !== null &&
                        format(t.vehicle.cost, { amount: formatMoney(record.cost_cents, record.currency ?? 'CAD', tag) }),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                  {record.notes && <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{record.notes}</p>}
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
