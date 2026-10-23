'use client';

import { type FormEvent, startTransition, useActionState, useState } from 'react';

import type { MessageState } from '@/lib/campaigns';
import { CAMPAIGN_BODY_MAX, CAMPAIGN_TITLE_MAX, type CampaignDraft, type CampaignField } from '@/lib/domain';
import { format, type Messages } from '@/lib/i18n/messages';

import { submitCampaign } from './actions';

type Props = {
  tenantId: string;
  shopName: string;
  /** Sends left in the current 30 days when the page loaded. */
  remaining: number;
  /** BCP 47 tag for dates, like `en-CA`. */
  localeTag: string;
  t: Messages['messages'];
};

/**
 * Compose, preview, send. Preview is a dry run of the send-campaign function
 * that counts who would get the message; the Send button only appears on a
 * preview, so staff always see the reach before anything goes out.
 */
export function ComposeForm({ tenantId, shopName, remaining, localeTag, t }: Props) {
  const [state, formAction, pending] = useActionState<MessageState, FormData>(submitCampaign.bind(null, tenantId), {
    status: 'idle',
  });
  // Editing after a preview goes back to composing, so what is sent is what was previewed.
  const [editedSincePreview, setEdited] = useState(false);
  const [draft, setDraft] = useState<Partial<CampaignDraft>>({ audience: 'all' });

  const previewing = state.status === 'preview' && !editedSincePreview;

  const errors: Partial<Record<CampaignField, string>> = {};
  if (state.status === 'invalid') {
    for (const [field, key] of Object.entries(state.errors)) {
      errors[field as CampaignField] = t.errors[`${field}_${key}` as keyof Messages['messages']['errors']];
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const data = new FormData(event.currentTarget);
    data.set('intent', submitter?.value ?? 'preview');
    setEdited(false);
    startTransition(() => formAction(data));
  }

  function edit(field: CampaignField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setEdited(true);
  }

  const fieldError = (field: CampaignField) =>
    errors[field] ? (
      <p id={`${field}-error`} className="error">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate>
      <section className="card">
        <div className="field">
          <label htmlFor="title">{t.titleLabel}</label>
          <input
            id="title"
            name="title"
            type="text"
            required
            maxLength={CAMPAIGN_TITLE_MAX}
            value={draft.title ?? ''}
            onChange={(e) => edit('title', e.target.value)}
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={['title-help', errors.title ? 'title-error' : null].filter(Boolean).join(' ')}
          />
          <span id="title-help" className="help">
            {format(t.titleHelp, { max: CAMPAIGN_TITLE_MAX })}
          </span>
          {fieldError('title')}
        </div>
        <div className="field">
          <label htmlFor="body">{t.bodyLabel}</label>
          <textarea
            id="body"
            name="body"
            rows={4}
            required
            maxLength={CAMPAIGN_BODY_MAX}
            value={draft.body ?? ''}
            onChange={(e) => edit('body', e.target.value)}
            aria-invalid={errors.body ? true : undefined}
            aria-describedby={['body-help', errors.body ? 'body-error' : null].filter(Boolean).join(' ')}
          />
          <span id="body-help" className="help">
            {format(t.bodyHelp, { count: (draft.body ?? '').length, max: CAMPAIGN_BODY_MAX })}
          </span>
          {fieldError('body')}
        </div>
        <fieldset aria-invalid={errors.audience ? true : undefined}>
          <legend className="label">{t.audience}</legend>
          {(['all', 'due_soon'] as const).map((audience) => (
            <label key={audience} className="radio">
              <input
                type="radio"
                name="audience"
                value={audience}
                checked={draft.audience === audience}
                onChange={() => edit('audience', audience)}
              />{' '}
              {t.audiences[audience]}
            </label>
          ))}
          {fieldError('audience')}
        </fieldset>
      </section>

      {previewing && state.status === 'preview' && <input type="hidden" name="campaignId" value={state.campaignId} />}

      {previewing && state.status === 'preview' && (
        <section className="card" aria-labelledby="preview-heading">
          <h2 id="preview-heading">{t.preview}</h2>
          <div className="notification-preview">
            <div className="notification-app">{shopName}</div>
            <strong>{state.draft.title}</strong>
            <div>{state.draft.body}</div>
          </div>
          <p>
            {state.customers === 0
              ? t.reachNone
              : format(t.reach, { customers: state.customers, devices: state.devices })}
          </p>
          {state.customers > 0 && state.devices < state.customers && <p className="muted">{t.reachNoPhone}</p>}
          <p className="muted">
            {state.allowance.remaining > 0
              ? format(t.remaining, { count: state.allowance.remaining })
              : format(t.limitReached, { date: formatDay(state.allowance.nextAvailableAt, localeTag) })}
          </p>
        </section>
      )}

      <div className="row">
        <button type="submit" name="intent" value="preview" className={previewing ? 'secondary' : undefined} disabled={pending}>
          {pending ? t.working : t.previewButton}
        </button>
        {previewing && state.status === 'preview' && state.devices > 0 && state.allowance.remaining > 0 && (
          <button type="submit" name="intent" value="send" disabled={pending}>
            {format(t.sendButton, { customers: state.customers })}
          </button>
        )}
        <p role="status" aria-live="polite" className={state.status === 'sent' ? 'success' : 'error'}>
          {state.status === 'invalid' && t.fixErrors}
          {state.status === 'sent' && format(t.sent, { sent: state.sent, failed: state.failed })}
          {state.status === 'alreadySent' && t.alreadySent}
          {state.status === 'interrupted' && t.interrupted}
          {state.status === 'noRecipients' && t.reachNone}
          {state.status === 'rateLimited' &&
            format(t.limitReached, { date: formatDay(state.nextAvailableAt, localeTag) })}
          {state.status === 'failed' && t.failed}
        </p>
      </div>
      {!previewing && remaining === 0 && <p className="muted">{t.limitReachedShort}</p>}
    </form>
  );
}

/** "November 21, 2026" for an ISO timestamp, or an empty string. */
function formatDay(iso: string | null, localeTag: string): string {
  return iso ? new Intl.DateTimeFormat(localeTag, { dateStyle: 'long' }).format(new Date(iso)) : '';
}
