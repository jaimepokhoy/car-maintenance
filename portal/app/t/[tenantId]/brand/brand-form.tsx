'use client';

import { type ChangeEvent, type FormEvent, startTransition, useActionState, useState } from 'react';

import type { Brand, BrandField } from '@/lib/brand';
import { DARK_ON_ACCENT, LIGHT_ON_ACCENT, contrastRatio, isHexColour, pickOnAccent } from '@/lib/contrast';
import { DAY_ORDER, hoursByDay, hoursFieldNames } from '@/lib/hours';
import { type Locale, type Messages, format, localeTag } from '@/lib/i18n/messages';
import { createClient } from '@/lib/supabase/browser';

import { type SaveState, saveBrand } from './actions';

export type TenantRow = {
  id: string;
  name: string;
  brand: Brand;
  phone: string | null;
  email: string | null;
  address: string | null;
  hours: unknown;
  booking_url: string | null;
  website_url: string | null;
};

type Props = {
  tenant: TenantRow;
  env: { url: string; anonKey: string };
  locale: Locale;
  t: Messages['brand'];
};

/** Today's app accent, used until the shop picks one. */
const DEFAULT_ACCENT = '#3DD9EB';
const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
const MAX_LOGO_BYTES = 1024 * 1024;

export function BrandForm({ tenant, env, locale, t }: Props) {
  const [state, formAction, saving] = useActionState<SaveState, FormData>(saveBrand.bind(null, tenant.id), {
    status: 'idle',
  });
  const [name, setName] = useState(tenant.name);
  const [accent, setAccent] = useState(tenant.brand.accent ?? DEFAULT_ACCENT);
  const [logoUrl, setLogoUrl] = useState(tenant.brand.logoUrl ?? '');
  const [logoStatus, setLogoStatus] = useState<'idle' | 'uploading' | 'tooBig' | 'wrongType' | 'failed'>('idle');
  const initialHours = hoursByDay(tenant.hours);
  const [openDays, setOpenDays] = useState(() => new Set(initialHours.keys()));

  const errors: Partial<Record<BrandField, string>> = {};
  if (state.status === 'invalid') {
    for (const [field, key] of Object.entries(state.errors)) errors[field as BrandField] = t.errors[key];
  }

  const validAccent = isHexColour(accent);
  const onAccent = validAccent ? pickOnAccent(accent) : null;
  const bestRatio = validAccent
    ? Math.max(contrastRatio(accent, DARK_ON_ACCENT), contrastRatio(accent, LIGHT_ON_ACCENT))
    : null;
  const ratioText =
    bestRatio === null ? '' : new Intl.NumberFormat(localeTag(locale), { maximumFractionDigits: 2 }).format(bestRatio);

  // Submit without React's automatic form reset, so a failed save keeps the edits.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  async function uploadLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const extension = LOGO_TYPES[file.type];
    if (!extension) return setLogoStatus('wrongType');
    if (file.size > MAX_LOGO_BYTES) return setLogoStatus('tooBig');

    setLogoStatus('uploading');
    const storage = createClient(env).storage.from('tenant-assets');
    const path = `${tenant.id}/logo-${Date.now()}.${extension}`;
    const { error } = await storage.upload(path, file, { contentType: file.type, cacheControl: '3600' });
    if (error) return setLogoStatus('failed');
    setLogoUrl(storage.getPublicUrl(path).data.publicUrl);
    setLogoStatus('idle');
  }

  const logoMessage =
    logoStatus === 'tooBig'
      ? t.logoTooBig
      : logoStatus === 'wrongType'
        ? t.logoWrongType
        : logoStatus === 'failed'
          ? t.logoFailed
          : (errors.logoUrl ?? null);

  const describedBy = (field: BrandField, help?: string) =>
    [help, errors[field] ? `${field}-error` : null].filter(Boolean).join(' ') || undefined;

  const fieldError = (field: BrandField) =>
    errors[field] ? (
      <p id={`${field}-error`} className="error">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate>
      <section className="card" aria-labelledby="logo-heading">
        <h2 id="logo-heading">{t.logo}</h2>
        <input type="hidden" name="logoUrl" value={logoUrl} />
        <div className="row">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, any Supabase host
            <img src={logoUrl} alt="" className="logo" />
          ) : (
            <p className="muted">{t.logoNone}</p>
          )}
        </div>
        <div className="field" style={{ marginTop: '0.75rem' }}>
          <label htmlFor="logo-file">{t.logoUpload}</label>
          <input
            id="logo-file"
            type="file"
            accept={Object.keys(LOGO_TYPES).join(',')}
            onChange={uploadLogo}
            disabled={logoStatus === 'uploading'}
            aria-describedby={['logo-help', logoMessage ? 'logo-error' : null].filter(Boolean).join(' ')}
          />
          <span id="logo-help" className="help">
            {logoStatus === 'uploading' ? t.logoUploading : t.logoHelp}
          </span>
          {logoMessage && (
            <p id="logo-error" className="error" role="alert">
              {logoMessage}
            </p>
          )}
        </div>
        {logoUrl && (
          <button type="button" className="secondary" onClick={() => setLogoUrl('')}>
            {t.logoRemove}
          </button>
        )}
      </section>

      <section className="card" aria-labelledby="accent-heading">
        <h2 id="accent-heading">{t.accent}</h2>
        <p id="accent-help" className="help">
          {t.accentHelp}
        </p>
        <div className="row">
          <input
            type="color"
            className="swatch"
            aria-label={t.accent}
            value={validAccent ? accent.toLowerCase() : '#000000'}
            onChange={(e) => setAccent(e.target.value.toUpperCase())}
          />
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="accent">{t.accentHex}</label>
            <input
              id="accent"
              name="accent"
              type="text"
              required
              maxLength={7}
              spellCheck={false}
              value={accent}
              onChange={(e) => setAccent(e.target.value.trim())}
              aria-invalid={errors.accent || !onAccent ? true : undefined}
              aria-describedby={describedBy('accent', 'accent-help contrast-status')}
            />
          </div>
        </div>
        <p id="contrast-status" role="status" className={onAccent ? 'success' : 'error'}>
          {validAccent ? (
            <>
              {format(t.contrast, { ratio: ratioText })} {onAccent ? t.contrastPass : t.contrastFail}
            </>
          ) : (
            t.errors.accentInvalid
          )}
        </p>
        {fieldError('accent')}
      </section>

      <section className="card" aria-labelledby="preview-heading">
        <h2 id="preview-heading">{t.preview}</h2>
        <p className="help">{t.previewHelp}</p>
        <div className="preview-grid">
          {(['light', 'dark'] as const).map((mode) => (
            <div key={mode} className={`preview preview-${mode}`}>
              <div className="label">{mode === 'light' ? t.previewLight : t.previewDark}</div>
              <div className="row" style={{ marginTop: '0.5rem' }}>
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element -- user-uploaded, any Supabase host
                  <img src={logoUrl} alt="" className="logo" />
                )}
                <strong>{name || '—'}</strong>
              </div>
              <span
                className="button"
                aria-hidden="true"
                style={{
                  background: validAccent ? accent : 'transparent',
                  color: onAccent ?? DARK_ON_ACCENT,
                }}
              >
                {t.previewButton}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="details-heading">
        <h2 id="details-heading">{t.details}</h2>
        <div className="field">
          <label htmlFor="name">{t.name}</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy('name')}
          />
          {fieldError('name')}
        </div>
        <div className="field">
          <label htmlFor="phone">{t.phone}</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={tenant.phone ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="email">{t.email}</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            maxLength={200}
            defaultValue={tenant.email ?? ''}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={describedBy('email')}
          />
          {fieldError('email')}
        </div>
        <div className="field">
          <label htmlFor="address">{t.address}</label>
          <textarea id="address" name="address" rows={2} maxLength={300} defaultValue={tenant.address ?? ''} />
        </div>
        <div className="field">
          <label htmlFor="bookingUrl">{t.bookingUrl}</label>
          <input
            id="bookingUrl"
            name="bookingUrl"
            type="url"
            maxLength={500}
            placeholder="https://"
            defaultValue={tenant.booking_url ?? ''}
            aria-invalid={errors.bookingUrl ? true : undefined}
            aria-describedby={describedBy('bookingUrl', 'url-help')}
          />
          {fieldError('bookingUrl')}
        </div>
        <div className="field">
          <label htmlFor="websiteUrl">{t.websiteUrl}</label>
          <input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            maxLength={500}
            placeholder="https://"
            defaultValue={tenant.website_url ?? ''}
            aria-invalid={errors.websiteUrl ? true : undefined}
            aria-describedby={describedBy('websiteUrl', 'url-help')}
          />
          {fieldError('websiteUrl')}
          <span id="url-help" className="help">
            {t.urlHelp}
          </span>
        </div>
      </section>

      <fieldset className="card" aria-describedby={describedBy('hours', 'hours-help')}>
        <legend>
          <h2 style={{ marginBottom: 0 }}>{t.hours}</h2>
        </legend>
        <p id="hours-help" className="help">
          {t.hoursHelp}
        </p>
        {DAY_ORDER.map((day) => {
          const names = hoursFieldNames(day);
          const saved = initialHours.get(day);
          const open = openDays.has(day);
          const dayName = t.days[day];
          return (
            <div key={day} className="hours-row">
              <label>
                <input
                  type="checkbox"
                  name={names.open}
                  checked={open}
                  onChange={(e) => {
                    const next = new Set(openDays);
                    if (e.target.checked) next.add(day);
                    else next.delete(day);
                    setOpenDays(next);
                  }}
                />{' '}
                {dayName}
              </label>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor={names.opens}>
                  {t.opens} <span className="visually-hidden">({dayName})</span>
                </label>
                <input
                  id={names.opens}
                  name={names.opens}
                  type="time"
                  disabled={!open}
                  defaultValue={saved?.opens ?? '08:00'}
                />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label htmlFor={names.closes}>
                  {t.closes} <span className="visually-hidden">({dayName})</span>
                </label>
                <input
                  id={names.closes}
                  name={names.closes}
                  type="time"
                  disabled={!open}
                  defaultValue={saved?.closes ?? '17:00'}
                />
              </div>
            </div>
          );
        })}
        {fieldError('hours')}
      </fieldset>

      <div className="row">
        <button type="submit" disabled={saving || logoStatus === 'uploading' || !onAccent}>
          {saving ? t.saving : t.save}
        </button>
        <p role="status" aria-live="polite" className={state.status === 'saved' ? 'success' : 'error'}>
          {state.status === 'saved' && t.saved}
          {state.status === 'invalid' && t.fixErrors}
          {state.status === 'failed' && t.saveFailed}
        </p>
      </div>
    </form>
  );
}
