import { redirect } from 'next/navigation';

import { isUnfinished } from '@/lib/campaigns';
import { loadMessagesPage } from '@/lib/campaigns-data';
import { CAMPAIGN_LIMIT, CAMPAIGN_WINDOW_DAYS } from '@/lib/domain';
import { format, localeTag } from '@/lib/i18n/messages';
import { getMessages } from '@/lib/i18n/server';
import { createClient } from '@/lib/supabase/server';

import { ComposeForm } from './compose-form';

/** Compose a reminder or promotion, preview who gets it, send it; past messages below. */
export default async function MessagesPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const { locale, t } = await getMessages();
  const supabase = await createClient();
  if (!supabase) return <p role="alert">{t.common.notConfigured}</p>;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const data = await loadMessagesPage(supabase, tenantId);
  if (!data) return <p role="alert">{t.messages.notFound}</p>;

  const tag = localeTag(locale);
  const sentOn = (iso: string) =>
    new Intl.DateTimeFormat(tag, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

  return (
    <>
      <h1>{t.messages.title}</h1>
      <p className="muted">{format(t.messages.intro, { limit: CAMPAIGN_LIMIT, days: CAMPAIGN_WINDOW_DAYS })}</p>

      <ComposeForm
        tenantId={tenantId}
        shopName={data.shopName}
        remaining={data.allowance.remaining}
        localeTag={tag}
        t={t.messages}
      />

      <h2 style={{ marginTop: '2rem' }}>{t.messages.history}</h2>
      {data.history === null ? (
        <p role="alert" className="error">
          {t.messages.historyFailed}
        </p>
      ) : data.history.length === 0 ? (
        <p className="muted">{t.messages.noHistory}</p>
      ) : (
        <ul className="plain-list">
          {data.history.map((campaign) => (
            <li key={campaign.id} className="card">
              <div className="row spread">
                <strong>{campaign.title}</strong>
                <span className="chip">{t.messages.audiences[campaign.audience]}</span>
              </div>
              <p style={{ margin: '0.25rem 0' }}>{campaign.body}</p>
              <p className="muted" style={{ margin: 0 }}>
                {sentOn(campaign.sent_at)} ·{' '}
                {campaign.sent_count === null
                  ? isUnfinished(campaign)
                    ? t.messages.unfinished
                    : t.messages.sending
                  : format(t.messages.delivered, { sent: campaign.sent_count, failed: campaign.failed_count ?? 0 })}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
