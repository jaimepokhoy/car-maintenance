-- RLS tests for the multi-tenant schema (20261022000000_tenancy.sql).
-- Run with `npx supabase test db` against a local stack.
--
-- Cast:
--   shop A (active), shop B (active), shop C (suspended)
--   staff_a works at shop A, staff_b at shop B
--   linked   has consented to shop A
--   unlinked has no link
--   revoked  consented to shop A and then revoked

begin;
create extension if not exists pgtap with schema extensions;

select plan(33);

-- Fixtures, written as postgres (bypasses RLS).
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-00000000000a', 'staff_a@test.ca', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'staff_b@test.ca', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000001', 'linked@test.ca', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'unlinked@test.ca', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000003', 'revoked@test.ca', 'authenticated', 'authenticated');

insert into public.tenants (id, slug, name, status, brand) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'shop-a', 'Shop A', 'active', '{"accent": "#FF6600"}'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'shop-b', 'Shop B', 'active', '{}'),
  ('cccccccc-0000-0000-0000-000000000000', 'shop-c', 'Shop C', 'suspended', '{}');

insert into public.tenant_staff (tenant_id, user_id, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000a', 'owner'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000000b', 'staff');

insert into public.customer_links (id, tenant_id, user_id, consented_at, revoked_at) values
  ('10000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', now(), null),
  ('10000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', now(), now());

insert into public.vehicles (id, user_id, nickname, year, make, model, powertrain, odometer_km, odometer_updated_on) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Linked car', 2020, 'Honda', 'Civic', 'gas', 50000, '2026-10-01'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Unlinked car', 2019, 'Toyota', 'RAV4', 'hybrid', 80000, '2026-10-01'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'Revoked car', 2021, 'Kia', 'Niro', 'ev', 30000, '2026-10-01');

insert into public.service_records (id, user_id, vehicle_id, item_ids, performed_on, odometer_km) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{oil_change}', '2026-09-01', 48000),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '{oil_change}', '2026-09-01', 78000),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000003', '{tire_rotation}', '2026-09-01', 29000);

insert into public.maintenance_intervals (vehicle_id, user_id, item_id, every_km) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'oil_change', 8000),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'oil_change', 8000);

insert into public.shops (id, user_id, name) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Linked shop'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Unlinked shop');

-- Staff of shop A ------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);

select results_eq(
  'select id from public.vehicles order by id',
  $$values ('20000000-0000-0000-0000-000000000001'::uuid)$$,
  'staff see only the vehicles of linked, non-revoked customers'
);
select results_eq(
  'select id from public.service_records order by id',
  $$values ('30000000-0000-0000-0000-000000000001'::uuid)$$,
  'staff see only the service records of linked, non-revoked customers'
);
select results_eq(
  'select vehicle_id from public.maintenance_intervals',
  $$values ('20000000-0000-0000-0000-000000000001'::uuid)$$,
  'staff see only the maintenance intervals of linked customers'
);
select results_eq(
  'select id from public.shops',
  $$values ('40000000-0000-0000-0000-000000000001'::uuid)$$,
  'staff see only the saved shops of linked customers'
);
select is_empty(
  $$select 1 from public.vehicles where user_id = '00000000-0000-0000-0000-000000000002'$$,
  'unlinked customers are invisible to staff'
);
select is_empty(
  $$select 1 from public.service_records where user_id = '00000000-0000-0000-0000-000000000003'$$,
  'customers who revoked consent are invisible to staff'
);
select results_eq(
  'select count(*)::int from public.customer_links',
  'values (2)',
  'staff read their own shop''s customer links'
);
select results_eq(
  'select slug from public.tenants',
  $$values ('shop-a')$$,
  'staff read only their own tenant'
);

-- Staff writing service records.
select lives_ok(
  $$insert into public.service_records (id, user_id, vehicle_id, item_ids, performed_on, odometer_km, created_by_tenant_id)
    values ('30000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
      '{brake_inspection}', '2026-10-20', 50100, 'aaaaaaaa-0000-0000-0000-000000000000')$$,
  'staff insert a service record for a linked customer with their own tenant'
);
select throws_ok(
  $$insert into public.service_records (id, user_id, vehicle_id, item_ids, performed_on, odometer_km, created_by_tenant_id)
    values ('30000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
      '{brake_inspection}', '2026-10-20', 50100, 'bbbbbbbb-0000-0000-0000-000000000000')$$,
  '42501', null,
  'staff cannot insert a service record marked as another tenant''s'
);
select throws_ok(
  $$insert into public.service_records (id, user_id, vehicle_id, item_ids, performed_on, odometer_km)
    values ('30000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001',
      '{brake_inspection}', '2026-10-20', 50100)$$,
  '42501', null,
  'staff cannot insert a service record without created_by_tenant_id'
);
select throws_ok(
  $$insert into public.service_records (id, user_id, vehicle_id, item_ids, performed_on, odometer_km, created_by_tenant_id)
    values ('30000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002',
      '{brake_inspection}', '2026-10-20', 80100, 'aaaaaaaa-0000-0000-0000-000000000000')$$,
  '42501', null,
  'staff cannot insert a service record for an unlinked customer'
);
select throws_ok(
  $$insert into public.service_records (id, user_id, vehicle_id, item_ids, performed_on, odometer_km, created_by_tenant_id)
    values ('30000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002',
      '{brake_inspection}', '2026-10-20', 80100, 'aaaaaaaa-0000-0000-0000-000000000000')$$,
  '42501', null,
  'staff cannot attach a linked customer''s record to someone else''s vehicle'
);

update public.service_records set notes = 'Pads at 6 mm' where id = '30000000-0000-0000-0000-0000000000a1';
update public.service_records set notes = 'Edited by shop' where id = '30000000-0000-0000-0000-000000000001';
select results_eq(
  $$select id, notes from public.service_records where user_id = '00000000-0000-0000-0000-000000000001' order by id$$,
  $$values ('30000000-0000-0000-0000-000000000001'::uuid, null::text), ('30000000-0000-0000-0000-0000000000a1'::uuid, 'Pads at 6 mm')$$,
  'staff update their tenant''s records but not the customer''s own'
);

-- Staff editing their tenant and campaigns.
update public.tenants set brand = '{"accent": "#0055FF"}' where slug = 'shop-a';
select results_eq(
  $$select brand->>'accent' from public.tenants where slug = 'shop-a'$$,
  $$values ('#0055FF')$$,
  'staff edit their tenant''s brand'
);
select throws_ok(
  $$update public.tenants set status = 'active' where slug = 'shop-a'$$,
  '42501', null,
  'staff cannot change their tenant''s status'
);
-- Campaigns are written by the send-campaign function (see campaigns.test.sql).
select throws_ok(
  $$insert into public.campaigns (tenant_id, title, body) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Winter tires', 'Book your swap')$$,
  '42501', null,
  'staff cannot write campaigns directly, even for their tenant'
);
select throws_ok(
  $$insert into public.campaigns (tenant_id, title, body) values ('bbbbbbbb-0000-0000-0000-000000000000', 'Winter tires', 'Book your swap')$$,
  '42501', null,
  'staff cannot create campaigns for another tenant'
);

-- Staff of shop B -------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}', true);

select is_empty('select 1 from public.vehicles', 'staff of another shop see none of shop A''s customers');
select is_empty('select 1 from public.campaigns', 'staff of another shop see none of shop A''s campaigns');

-- Linked customer -------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);

select results_eq(
  'select count(*)::int from public.service_records',
  'values (2)',
  'a customer sees shop-created records in their own history'
);
select throws_ok(
  $$insert into public.tenants (slug, name) values ('my-shop', 'My shop')$$,
  '42501', null,
  'customers cannot create tenants'
);
update public.tenants set name = 'Hijacked' where slug = 'shop-a';
select throws_ok(
  $$insert into public.campaigns (tenant_id, title, body) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Spam', 'Spam')$$,
  '42501', null,
  'customers cannot create campaigns'
);
select is_empty('select 1 from public.campaigns', 'customers cannot read campaigns');
select throws_ok(
  $$insert into public.service_records (id, vehicle_id, item_ids, performed_on, odometer_km, created_by_tenant_id)
    values ('30000000-0000-0000-0000-0000000000c1', '20000000-0000-0000-0000-000000000001',
      '{oil_change}', '2026-10-21', 50200, 'aaaaaaaa-0000-0000-0000-000000000000')$$,
  '42501', null,
  'customers cannot mark their own records as shop-created'
);
select lives_ok(
  $$insert into public.service_records (id, vehicle_id, item_ids, performed_on, odometer_km, created_by_tenant_id, notes)
    values ('30000000-0000-0000-0000-0000000000a1', '20000000-0000-0000-0000-000000000001',
      '{brake_inspection}', '2026-10-20', 50100, 'aaaaaaaa-0000-0000-0000-000000000000', 'Synced from phone')
    on conflict (id) do update set notes = excluded.notes$$,
  'customers can sync a shop-created record back unchanged'
);
select throws_ok(
  $$update public.service_records set created_by_tenant_id = 'bbbbbbbb-0000-0000-0000-000000000000'
    where id = '30000000-0000-0000-0000-0000000000a1'$$,
  '42501', null,
  'customers cannot re-mark a shop-created record as another shop''s'
);

-- Revoking consent removes access immediately.
update public.customer_links set revoked_at = now() where tenant_id = 'aaaaaaaa-0000-0000-0000-000000000000';

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}', true);
select is_empty('select 1 from public.vehicles', 'after revoking, staff no longer see the customer''s vehicles');
select is_empty('select 1 from public.service_records', 'after revoking, staff no longer see the customer''s records');
update public.service_records set notes = 'Edited after revoke' where id = '30000000-0000-0000-0000-0000000000a1';

-- Anonymous visitors ----------------------------------------------------------
reset role;
select is(
  (select name from public.tenants where slug = 'shop-a'),
  'Shop A',
  'customers cannot rename a tenant'
);
select is(
  (select notes from public.service_records where id = '30000000-0000-0000-0000-0000000000a1'),
  'Synced from phone',
  'after revoking, staff can no longer edit their shop''s records for that customer'
);

set local role anon;
select results_eq(
  'select slug from public.tenant_profiles order by slug',
  $$values ('shop-a'), ('shop-b')$$,
  'anon reads profiles of active tenants only'
);
select throws_ok('select 1 from public.tenants', '42501', null, 'anon cannot read tenants');

select * from finish();
rollback;
