import Link from 'next/link';
import { redirect } from 'next/navigation';

import { canadianToday, vehicleLabel } from '@/lib/customers';
import { loadCustomerList } from '@/lib/customers-data';
import { formatDate, formatDistance } from '@/lib/domain';
import { dueText } from '@/lib/due-text';
import { format, localeTag } from '@/lib/i18n/messages';
import { getMessages } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';

/** Linked, non-revoked customers with their vehicles and what is due, most urgent first. */
export default async function CustomersPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const { locale, t } = await getMessages();
  const supabase = await createClient();
  if (!supabase) return <p role="alert">{t.common.notConfigured}</p>;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const customers = await loadCustomerList(supabase, tenantId, canadianToday());
  const tag = localeTag(locale);

  return (
    <>
      <h1>{t.customers.title}</h1>
      <p className="muted">{t.customers.intro}</p>
      {customers === null ? (
        <p role="alert" className="error">
          {t.customers.loadFailed}
        </p>
      ) : customers.length === 0 ? (
        <p className="card">{t.customers.none}</p>
      ) : (
        <ul className="plain-list">
          {customers.map((customer) => (
            <li key={customer.userId} className="card">
              <div className="row spread">
                <h2 style={{ marginBottom: 0 }}>
                  {format(t.customers.customerSince, { date: formatDate(customer.consentedAt.slice(0, 10), tag) })}
                </h2>
                <div className="row">
                  {customer.overdue > 0 && (
                    <span className="chip chip-overdue">{format(t.customers.overdueCount, { count: customer.overdue })}</span>
                  )}
                  {customer.dueSoon > 0 && (
                    <span className="chip chip-due_soon">{format(t.customers.dueSoonCount, { count: customer.dueSoon })}</span>
                  )}
                  {customer.overdue === 0 && customer.dueSoon === 0 && (
                    <span className="chip">{t.customers.nothingDue}</span>
                  )}
                </div>
              </div>
              {customer.vehicles.length === 0 ? (
                <p className="muted">{t.customers.noVehicles}</p>
              ) : (
                <ul className="plain-list">
                  {customer.vehicles.map(({ vehicle, odometerKm, due }) => (
                    <li key={vehicle.id} className="vehicle-row">
                      <Link href={`/t/${tenantId}/vehicles/${vehicle.id}`}>
                        <strong>{vehicleLabel(vehicle)}</strong>
                      </Link>
                      <div className="muted">
                        {[vehicle.nickname, vehicle.licence_plate, formatDistance(odometerKm, 'km', tag)]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                      {due.length === 0 ? (
                        <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                          {t.customers.allClear}
                        </p>
                      ) : (
                        <ul className="due-list">
                          {due.map((status) => (
                            <li key={status.itemId}>
                              <span className={`chip chip-${status.state}`}>{t.due[status.state]}</span>{' '}
                              {t.items[status.itemId]} <span className="muted">{dueText(status, locale, t.due)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
