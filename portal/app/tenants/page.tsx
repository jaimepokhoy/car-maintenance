import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getMessages } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';

type Membership = { role: 'owner' | 'staff'; tenants: { id: string; name: string; slug: string } | null };

/** Staff at one shop go straight to its Brand page; staff at several pick one. */
export default async function TenantsPage() {
  const { t } = await getMessages();
  const supabase = await createClient();
  if (!supabase) return <p role="alert">{t.common.notConfigured}</p>;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const { data } = await supabase
    .from('tenant_staff')
    .select('role, tenants(id, name, slug)')
    .eq('user_id', user.id)
    .returns<Membership[]>();
  const memberships = (data ?? [])
    .filter((m): m is Membership & { tenants: NonNullable<Membership['tenants']> } => m.tenants !== null)
    .sort((a, b) => a.tenants.name.localeCompare(b.tenants.name));

  if (memberships.length === 1) redirect(`/t/${memberships[0].tenants.id}/brand`);

  return (
    <>
      <h1>{t.tenants.title}</h1>
      {memberships.length === 0 ? (
        <p>{t.tenants.none}</p>
      ) : (
        <>
          <p className="muted">{t.tenants.intro}</p>
          <ul className="tenant-list">
            {memberships.map(({ role, tenants: tenant }) => (
              <li key={tenant.id}>
                <Link href={`/t/${tenant.id}/brand`}>
                  <strong>{tenant.name}</strong>
                  <br />
                  <span className="muted">{role === 'owner' ? t.tenants.owner : t.tenants.staff}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
