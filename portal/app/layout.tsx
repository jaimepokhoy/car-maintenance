import type { Metadata } from 'next';

import { getMessages } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';

import { signOut, toggleLocale } from './actions';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getMessages();
  return { title: t.common.appName };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = await getMessages();
  const supabase = await createClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;

  return (
    <html lang={locale === 'fr' ? 'fr-CA' : 'en-CA'}>
      <body>
        <header className="site-header">
          <span className="site-title">{t.common.appName}</span>
          <div className="row">
            <form action={toggleLocale}>
              <button type="submit" className="link-button" lang={locale === 'fr' ? 'en' : 'fr'}>
                {t.common.language}
              </button>
            </form>
            {user && (
              <form action={signOut}>
                <button type="submit" className="link-button">
                  {t.common.signOut}
                </button>
              </form>
            )}
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
