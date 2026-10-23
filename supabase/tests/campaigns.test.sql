-- Tests for campaign sending (20261022220000_campaign_sending.sql).
-- Run with `npx supabase test db` against a local stack.
--
-- Cast: shop A (active) with staff_a, shop B (active) with staff_b, shop C
-- (suspended). The send-campaign function runs as service_role and calls
-- start_campaign with a 720-hour window and a 15-minute stale limit.

begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000ca', 'campaign_staff_a@test.ca', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000cb', 'campaign_staff_b@test.ca', 'authenticated', 'authenticated');

insert into public.tenants (id, slug, name, status) values
  ('aaaaaaaa-0000-0000-0000-0000000000ca', 'campaign-shop-a', 'Shop A', 'active'),
  ('bbbbbbbb-0000-0000-0000-0000000000cb', 'campaign-shop-b', 'Shop B', 'active'),
  ('cccccccc-0000-0000-0000-0000000000cc', 'campaign-shop-c', 'Shop C', 'suspended');

insert into public.tenant_staff (tenant_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-0000000000ca', 'owner'),
  ('bbbbbbbb-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-0000000000cb', 'staff');

-- Shop A's history, none of which counts toward the limit: a send that
-- reached nobody, one older than 30 days, and one that stopped before its
-- first batch an hour ago.
insert into public.campaigns (id, tenant_id, title, body, status, sent_at, sent_count) values
  ('50000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'Outage', 'Nobody got this', 'sent', now() - interval '1 day', 0),
  ('50000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'Old', 'Long ago', 'sent', now() - interval '31 days', 12),
  ('50000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'Stuck', 'Killed mid-send', 'sent', now() - interval '1 hour', null);

insert into public.campaign_failures (campaign_id, tenant_id, error, message) values
  ('50000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'RequestFailed', 'HTTP 503');

-- start_campaign with the function's limits.
create function pg_temp.start(id text, tenant text, title text) returns text language sql as $$
  select public.start_campaign(id::uuid, tenant::uuid, title, 'Body', 'all', null, 3, 4, interval '720 hours', interval '15 minutes');
$$;

-- The function, as service_role -----------------------------------------------
set local role service_role;

select is(pg_temp.start('60000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'One'), 'started', 'the first send of the month starts');
select is(pg_temp.start('60000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'Two'), 'started', 'the second send starts');
select is(pg_temp.start('60000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'Three'), 'started', 'the third send starts');
select is(
  pg_temp.start('60000000-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'Four'),
  'started',
  'the fourth send starts: failed, old and stuck campaigns do not count'
);
select is(
  pg_temp.start('60000000-0000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'Five'),
  'rate_limited',
  'the fifth send in 30 days is refused'
);
select results_eq(
  $$select count(*)::int from public.campaigns where title = 'Five'$$,
  'values (0)',
  'a refused send leaves no campaign behind'
);
select is(
  pg_temp.start('60000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'One again'),
  'duplicate',
  'sending the same preview twice is recognised'
);
select results_eq(
  $$select status, recipient_count, sent_count is null from public.campaigns where id = '60000000-0000-0000-0000-000000000001'$$,
  $$values ('sent'::text, 3, true)$$,
  'a started campaign is recorded as sent under its id, with its recipient count and no progress yet'
);
select is(pg_temp.start('60000000-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-0000000000cb', 'B'), 'started', 'each shop has its own limit');
select throws_ok(
  $$select pg_temp.start('60000000-0000-0000-0000-0000000000c1', 'cccccccc-0000-0000-0000-0000000000cc', 'C')$$,
  'P0002', null,
  'a suspended shop cannot send'
);

-- Staff of shop A ---------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000ca", "role": "authenticated"}', true);

select results_eq(
  'select count(*)::int from public.campaigns',
  'values (7)',
  'staff read their shop''s campaigns'
);
select results_eq(
  'select error from public.campaign_failures',
  $$values ('RequestFailed')$$,
  'staff read their shop''s delivery failures'
);
select throws_ok(
  $$select public.start_campaign(gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-0000000000ca', 'Sneaky', 'Body', 'all', null, 1, 99, interval '1 second', interval '1 second')$$,
  '42501', null,
  'staff cannot start a send without the function'
);
select throws_ok(
  $$delete from public.campaigns where id = '50000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'staff cannot delete sent campaigns to get around the limit'
);
select throws_ok(
  $$update public.campaigns set sent_at = now() - interval '90 days'$$,
  '42501', null,
  'staff cannot backdate campaigns'
);
select throws_ok(
  $$insert into public.campaigns (tenant_id, title, body) values ('aaaaaaaa-0000-0000-0000-0000000000ca', 'Direct', 'Body')$$,
  '42501', null,
  'staff cannot create campaigns directly'
);
select throws_ok(
  $$insert into public.campaign_failures (campaign_id, tenant_id, error) values ('50000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'x')$$,
  '42501', null,
  'staff cannot write delivery failures'
);

-- Staff of shop B ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000cb", "role": "authenticated"}', true);

select results_eq(
  'select title from public.campaigns',
  $$values ('B')$$,
  'staff of another shop see only their own campaigns'
);
select is_empty('select 1 from public.campaign_failures', 'staff of another shop see none of shop A''s failures');

select * from finish();
rollback;
