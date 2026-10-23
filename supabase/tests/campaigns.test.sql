-- Tests for campaign sending (20261022220000_campaign_sending.sql).
-- Run with `npx supabase test db` against a local stack.
--
-- Cast: shop A (active) with staff_a, shop B (active) with staff_b, shop C
-- (suspended). The send-campaign function runs as service_role.

begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

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

-- Shop A's history: one send that reached nobody and one older than 30 days,
-- neither of which counts toward the limit.
insert into public.campaigns (id, tenant_id, title, body, status, sent_at, sent_count) values
  ('50000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'Outage', 'Nobody got this', 'sent', now() - interval '1 day', 0),
  ('50000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'Old', 'Long ago', 'sent', now() - interval '31 days', 12);

insert into public.campaign_failures (campaign_id, tenant_id, error, message) values
  ('50000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-0000000000ca', 'RequestFailed', 'HTTP 503');

-- The function, as service_role -----------------------------------------------
set local role service_role;

select isnt(
  public.start_campaign('aaaaaaaa-0000-0000-0000-0000000000ca', 'One', 'Body', 'all', '00000000-0000-0000-0000-0000000000ca', 3, 4, interval '30 days'),
  null,
  'the first send of the month starts'
);
select isnt(
  public.start_campaign('aaaaaaaa-0000-0000-0000-0000000000ca', 'Two', 'Body', 'due_soon', '00000000-0000-0000-0000-0000000000ca', 3, 4, interval '30 days'),
  null,
  'the second send starts'
);
select isnt(
  public.start_campaign('aaaaaaaa-0000-0000-0000-0000000000ca', 'Three', 'Body', 'all', '00000000-0000-0000-0000-0000000000ca', 3, 4, interval '30 days'),
  null,
  'the third send starts'
);
select isnt(
  public.start_campaign('aaaaaaaa-0000-0000-0000-0000000000ca', 'Four', 'Body', 'all', '00000000-0000-0000-0000-0000000000ca', 3, 4, interval '30 days'),
  null,
  'the fourth send starts: the failed and the old campaign do not count'
);
select is(
  public.start_campaign('aaaaaaaa-0000-0000-0000-0000000000ca', 'Five', 'Body', 'all', '00000000-0000-0000-0000-0000000000ca', 3, 4, interval '30 days'),
  null,
  'the fifth send in 30 days is refused'
);
select results_eq(
  $$select count(*)::int from public.campaigns where tenant_id = 'aaaaaaaa-0000-0000-0000-0000000000ca' and title = 'Five'$$,
  'values (0)',
  'a refused send leaves no campaign behind'
);
select results_eq(
  $$select status, recipient_count, sent_count is null from public.campaigns where title = 'One'$$,
  $$values ('sent'::text, 3, true)$$,
  'a started campaign is recorded as sent with its recipient count, delivery still pending'
);
select isnt(
  public.start_campaign('bbbbbbbb-0000-0000-0000-0000000000cb', 'B', 'Body', 'all', '00000000-0000-0000-0000-0000000000cb', 1, 4, interval '30 days'),
  null,
  'each shop has its own limit'
);
select throws_ok(
  $$select public.start_campaign('cccccccc-0000-0000-0000-0000000000cc', 'C', 'Body', 'all', null, 1, 4, interval '30 days')$$,
  'P0002', null,
  'a suspended shop cannot send'
);

-- Staff of shop A ---------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000ca", "role": "authenticated"}', true);

select results_eq(
  'select count(*)::int from public.campaigns',
  'values (6)',
  'staff read their shop''s campaigns'
);
select results_eq(
  'select error from public.campaign_failures',
  $$values ('RequestFailed')$$,
  'staff read their shop''s delivery failures'
);
select throws_ok(
  $$select public.start_campaign('aaaaaaaa-0000-0000-0000-0000000000ca', 'Sneaky', 'Body', 'all', null, 1, 99, interval '1 second')$$,
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
