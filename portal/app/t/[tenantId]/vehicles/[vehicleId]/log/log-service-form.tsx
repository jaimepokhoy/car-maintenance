'use client';

import Link from 'next/link';
import { type FormEvent, startTransition, useActionState } from 'react';

import type { Messages } from '@/lib/i18n/messages';
import { MAX_NOTES_LENGTH, type ServiceLogField } from '@/lib/service-log';

import { type LogState, logService } from './actions';

type Props = {
  tenantId: string;
  vehicleId: string;
  /** Generated with the page, so a double submit saves one record. */
  recordId: string;
  items: { id: string; label: string }[];
  today: string;
  /** Best known reading, shown as a hint; staff enter the real one. */
  odometerKm: number;
  t: Messages['logService'];
};

export function LogServiceForm({ tenantId, vehicleId, recordId, items, today, odometerKm, t }: Props) {
  const [state, formAction, saving] = useActionState<LogState, FormData>(
    logService.bind(null, tenantId, vehicleId),
    { status: 'idle' },
  );

  const errors: Partial<Record<ServiceLogField, string>> = {};
  if (state.status === 'invalid') {
    for (const [field, key] of Object.entries(state.errors)) errors[field as ServiceLogField] = t.errors[key];
  }

  // Submit without React's automatic form reset, so a failed save keeps the entries.
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  }

  const describedBy = (field: ServiceLogField, help?: string) =>
    [help, errors[field] ? `${field}-error` : null].filter(Boolean).join(' ') || undefined;

  const fieldError = (field: ServiceLogField) =>
    errors[field] ? (
      <p id={`${field}-error`} className="error">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form onSubmit={submit} noValidate>
      <input type="hidden" name="id" value={recordId} />

      <fieldset className="card" aria-describedby={describedBy('itemIds')} aria-invalid={errors.itemIds ? true : undefined}>
        <legend>
          <h2 style={{ marginBottom: 0 }}>{t.items}</h2>
        </legend>
        <div className="checkbox-grid">
          {items.map((item) => (
            <label key={item.id}>
              <input type="checkbox" name="itemIds" value={item.id} /> {item.label}
            </label>
          ))}
        </div>
        {fieldError('itemIds')}
      </fieldset>

      <section className="card">
        <div className="field">
          <label htmlFor="performedOn">{t.performedOn}</label>
          <input
            id="performedOn"
            name="performedOn"
            type="date"
            required
            max={today}
            defaultValue={today}
            aria-invalid={errors.performedOn ? true : undefined}
            aria-describedby={describedBy('performedOn')}
          />
          {fieldError('performedOn')}
        </div>
        <div className="field">
          <label htmlFor="odometerKm">{t.odometer}</label>
          <input
            id="odometerKm"
            name="odometerKm"
            type="text"
            inputMode="numeric"
            required
            maxLength={12}
            placeholder={String(odometerKm)}
            aria-invalid={errors.odometerKm ? true : undefined}
            aria-describedby={describedBy('odometerKm', 'odometer-help')}
          />
          <span id="odometer-help" className="help">
            {t.odometerHelp}
          </span>
          {fieldError('odometerKm')}
        </div>
        <div className="field">
          <label htmlFor="cost">{t.cost}</label>
          <input
            id="cost"
            name="cost"
            type="text"
            inputMode="decimal"
            maxLength={15}
            aria-invalid={errors.cost ? true : undefined}
            aria-describedby={describedBy('cost', 'cost-help')}
          />
          <span id="cost-help" className="help">
            {t.costHelp}
          </span>
          {fieldError('cost')}
        </div>
        <div className="field">
          <label htmlFor="notes">{t.notes}</label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            maxLength={MAX_NOTES_LENGTH}
            aria-invalid={errors.notes ? true : undefined}
            aria-describedby={describedBy('notes', 'notes-help')}
          />
          <span id="notes-help" className="help">
            {t.notesHelp}
          </span>
          {fieldError('notes')}
        </div>
      </section>

      {errors.id && (
        <p role="alert" className="error">
          {errors.id}
        </p>
      )}

      <div className="row">
        <button type="submit" disabled={saving}>
          {saving ? t.saving : t.save}
        </button>
        <Link href={`/t/${tenantId}/vehicles/${vehicleId}`}>{t.cancel}</Link>
        <p role="status" aria-live="polite" className="error">
          {state.status === 'invalid' && t.fixErrors}
          {state.status === 'failed' && t.saveFailed}
        </p>
      </div>
    </form>
  );
}
