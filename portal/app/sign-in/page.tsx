import { redirect } from 'next/navigation';

import { getMessages } from '@/lib/i18n/server';
import { supabaseEnv } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

import { SignInForm } from './sign-in-form';

export default async function SignInPage() {
  const { t } = await getMessages();
  const env = supabaseEnv();
  const supabase = await createClient();
  if (supabase && (await supabase.auth.getUser()).data.user) redirect('/tenants');

  return (
    <>
      <h1>{t.signIn.title}</h1>
      <p className="muted">{t.signIn.intro}</p>
      {env ? <SignInForm env={env} t={t.signIn} /> : <p role="alert">{t.common.notConfigured}</p>}
    </>
  );
}
