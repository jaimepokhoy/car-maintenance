import { getMessages } from '@/lib/i18n/server';

import { TenantNav } from './tenant-nav';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const { t } = await getMessages();
  return (
    <>
      <TenantNav tenantId={tenantId} t={t.nav} />
      {children}
    </>
  );
}
