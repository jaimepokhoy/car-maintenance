import Link from 'next/link';
import { redirect } from 'next/navigation';

import type { Brand } from '@/lib/brand';
import { getMessages } from '@/lib/i18n/server';
import { supabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

import { BrandForm, type TenantRow } from './brand-form';

export default async function BrandPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const { locale, t } = await getMessages();
  const env = supabaseEnv();
  const supabase = await createClient();
  if (!env || !supabase) return <p role="alert">{t.common.notConfigured}</p>;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const [{ data: tenant }, { count }] = await Promise.all([
    supabase
      .from('tenants')
      .select('id, name, brand, phone, email, address, hours, booking_url, website_url')
      .eq('id', tenantId)
      .maybeSingle<TenantRow & { brand: Brand }>(),
    supabase.from('tenant_staff').select('tenant_id', { count: 'exact', head: true }).eq('user_id', user.id),
  ]);

  if (!tenant) {
    return (
      <>
        <h1>{t.brand.title}</h1>
        <p role="alert">{t.brand.notFound}</p>
        <Link href="/tenants">{t.brand.switchShop}</Link>
      </>
    );
  }

  return (
    <>
      <div className="row spread">
        <h1>
          {t.brand.title}: {tenant.name}
        </h1>
        {(count ?? 0) > 1 && <Link href="/tenants">{t.brand.switchShop}</Link>}
      </div>
      <p className="muted">{t.brand.intro}</p>
      <BrandForm tenant={tenant} env={env} locale={locale} t={t.brand} />
    </>
  );
}
