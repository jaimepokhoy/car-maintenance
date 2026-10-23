import { describe, expect, it } from 'vitest';

import { type CampaignRow, allowanceFromHistory, isUnfinished, parseCampaignForm, toMessageState } from '../campaigns';
import { en } from '../i18n/messages';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const ID = '6f1c1d2e-0000-4000-8000-000000000001';
const draft = { title: 'Winter tires', body: 'Book your swap.', audience: 'all' as const };

describe('parseCampaignForm', () => {
  it('accepts a complete campaign', () => {
    expect(parseCampaignForm(form({ title: ' Winter tires ', body: 'Book your swap.', audience: 'all' }))).toEqual({
      ok: true,
      draft,
    });
  });

  it('keeps what was typed when something is wrong', () => {
    expect(parseCampaignForm(form({ title: '', body: 'Hello', audience: 'everyone' }))).toEqual({
      ok: false,
      state: {
        status: 'invalid',
        draft: { title: '', body: 'Hello', audience: undefined },
        errors: { title: 'required', audience: 'invalid' },
      },
    });
  });

  it('has a message for every error the rules can give', () => {
    for (const field of ['title', 'body', 'audience']) {
      for (const error of ['required', 'tooLong', 'invalid']) {
        expect(en.messages.errors).toHaveProperty(`${field}_${error}`);
      }
    }
  });
});

describe('toMessageState', () => {
  it('shows a dry run as a preview', () => {
    const allowance = { remaining: 2, nextAvailableAt: null };
    expect(toMessageState(200, { dryRun: true, customers: 5, devices: 7, allowance }, draft, ID)).toEqual({
      status: 'preview',
      draft,
      campaignId: ID,
      customers: 5,
      devices: 7,
      allowance,
    });
  });

  it('reports a send', () => {
    expect(
      toMessageState(200, { dryRun: false, campaignId: 'c', customers: 5, devices: 7, sent: 6, failed: 1 }, draft, ID),
    ).toEqual({ status: 'sent', customers: 5, devices: 7, sent: 6, failed: 1 });
  });

  it('explains the rate limit and when it lifts', () => {
    const body = { error: 'rate_limited', limit: 4, allowance: { remaining: 0, nextAvailableAt: '2026-11-21T15:00:00.000Z' } };
    expect(toMessageState(429, body, draft, ID)).toEqual({
      status: 'rateLimited',
      draft,
      nextAvailableAt: '2026-11-21T15:00:00.000Z',
    });
  });

  it('says when nobody would get it', () => {
    expect(toMessageState(422, { error: 'no_recipients' }, draft, ID)).toEqual({ status: 'noRecipients', draft });
  });

  it('recognises a preview that was already sent', () => {
    expect(toMessageState(409, { error: 'already_sent', campaignId: ID }, draft, ID)).toEqual({ status: 'alreadySent', draft });
  });

  it('warns when a send started but did not report back', () => {
    expect(toMessageState(500, { error: 'send_interrupted' }, draft, ID)).toEqual({ status: 'interrupted', draft });
  });

  it('treats anything else as a failure', () => {
    expect(toMessageState(500, { error: 'internal' }, draft, ID)).toEqual({ status: 'failed', draft });
    expect(toMessageState(403, null, draft, ID)).toEqual({ status: 'failed', draft });
    expect(toMessageState(200, { dryRun: true }, draft, ID)).toEqual({ status: 'failed', draft });
  });
});

describe('allowanceFromHistory', () => {
  const row = (sentAt: string, sentCount: number | null): CampaignRow => ({
    id: sentAt,
    title: 't',
    body: 'b',
    audience: 'all',
    sent_at: sentAt,
    recipient_count: 1,
    sent_count: sentCount,
    failed_count: 0,
  });

  it('counts sends in the last 30 days that reached someone', () => {
    const now = new Date('2026-10-22T12:00:00Z');
    expect(allowanceFromHistory([row('2026-10-20T00:00:00Z', 3), row('2026-10-21T00:00:00Z', 0)], now).remaining).toBe(3);
  });
});

describe('isUnfinished', () => {
  const now = new Date('2026-10-22T12:00:00Z');

  it('flags a send with no progress after 15 minutes', () => {
    expect(isUnfinished({ sent_at: '2026-10-22T11:30:00Z', sent_count: null }, now)).toBe(true);
    expect(isUnfinished({ sent_at: '2026-10-22T11:55:00Z', sent_count: null }, now)).toBe(false);
    expect(isUnfinished({ sent_at: '2026-10-22T11:30:00Z', sent_count: 0 }, now)).toBe(false);
  });
});
