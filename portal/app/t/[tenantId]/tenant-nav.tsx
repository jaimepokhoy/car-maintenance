'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import type { Messages } from '@/lib/i18n/messages';

/** Customers, Messages and Brand tabs for one shop; vehicle pages count as Customers. */
export function TenantNav({ tenantId, t }: { tenantId: string; t: Messages['nav'] }) {
  const pathname = usePathname();
  const base = `/t/${tenantId}`;
  const links = [
    { href: `${base}/customers`, label: t.customers, active: [`${base}/customers`, `${base}/vehicles`] },
    { href: `${base}/messages`, label: t.messages, active: [`${base}/messages`] },
    { href: `${base}/brand`, label: t.brand, active: [`${base}/brand`] },
  ];

  return (
    <nav aria-label={t.label} className="tenant-nav">
      {links.map((link) => {
        const current = link.active.some((prefix) => pathname.startsWith(prefix));
        return (
          <Link key={link.href} href={link.href} aria-current={current ? 'page' : undefined}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
