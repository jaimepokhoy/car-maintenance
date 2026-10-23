-- A customer may change only the notes (and deleted_at) of a service record
-- a shop logged (20261022230000_shop_record_fields.sql).
-- Run with `npx supabase test db` against a local stack.

begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- Fixtures, written as postgres (bypasses RLS).
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000fa', 'staff@fields.test', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f1', 'customer@fields.test', 'authenticated', 'authenticated');

insert into public.tenants (id, slug, name) values
  ('ffffffff-0000-0000-0000-000000000000', 'fields-shop', 'Fields Shop');

insert into public.tenant_staff (tenant_id, user_id, role) values
  ('ffffffff-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000fa', 'staff');

insert into public.customer_links (id, tenant_id, user_id, consented_at) values
  ('1f000000-0000-0000-0000-000000000001', 'ffffffff-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000f1', now());

insert into public.vehicles (id, user_id, nickname, year, make, model, powertrain, odometer_km, odometer_updated_on) values
  ('2f000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', 'Car', 2020, 'Honda', 'Civic', 'gas', 50000, '2026-10-01');

-- One record the shop logged, with a created_at finer than a millisecond like
-- any server-made row, and one the customer logged.
insert into public.service_records
  (id, user_id, vehicle_id, item_ids, performed_on, odometer_km, cost_cents, currency, created_by_tenant_id, created_at) values
  ('3f000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1', '2f000000-0000-0000-0000-000000000001',
    '{oil_change}', '2026-10-01', 49000, 8999, 'CAD', 'ffffffff-0000-0000-0000-000000000000', '2026-10-01 12:00:00.123456+00'),
  ('3f000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000f1', '2f000000-0000-0000-0000-000000000001',
    '{tire_rotation}', '2026-09-01', 48000, null, null, null, '2026-09-01 12:00:00.123456+00');

-- The customer ----------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated"}', true);

select lives_ok(
  $$update public.service_records set notes = 'Asked about the noise' where id = '3f000000-0000-0000-0000-000000000001'$$,
  'the customer can edit the notes on a shop-logged record'
);

-- What sync sends: every synced column, created_at cut to milliseconds by the device.
select lives_ok(
  $$insert into public.service_records
      (id, user_id, vehicle_id, item_ids, performed_on, odometer_km, cost_cents, currency, shop_id, notes,
       created_by_tenant_id, created_at, deleted_at)
    values ('3f000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1',
      '2f000000-0000-0000-0000-000000000001', '{oil_change}', '2026-10-01', 49000, 8999, 'CAD', null,
      'Noise is gone', 'ffffffff-0000-0000-0000-000000000000', '2026-10-01 12:00:00.123+00', null)
    on conflict (id) do update set
      user_id = excluded.user_id, vehicle_id = excluded.vehicle_id, item_ids = excluded.item_ids,
      performed_on = excluded.performed_on, odometer_km = excluded.odometer_km, cost_cents = excluded.cost_cents,
      currency = excluded.currency, shop_id = excluded.shop_id, notes = excluded.notes,
      created_by_tenant_id = excluded.created_by_tenant_id, created_at = excluded.created_at,
      deleted_at = excluded.deleted_at$$,
  'a sync upsert that changes only the notes goes through'
);

select throws_ok(
  $$update public.service_records set odometer_km = 1 where id = '3f000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'the customer cannot change the reading on a shop-logged record'
);
select throws_ok(
  $$update public.service_records set cost_cents = 0 where id = '3f000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'the customer cannot change the cost on a shop-logged record'
);
select throws_ok(
  $$update public.service_records set performed_on = '2026-01-01', item_ids = '{brake_inspection}'
    where id = '3f000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'the customer cannot change the work or date on a shop-logged record'
);
select throws_ok(
  $$update public.service_records set created_by_tenant_id = null where id = '3f000000-0000-0000-0000-000000000001'$$,
  '42501', null,
  'the customer cannot clear the shop stamp to unlock the record'
);
select throws_ok(
  $$insert into public.service_records
      (id, user_id, vehicle_id, item_ids, performed_on, odometer_km, created_by_tenant_id)
    values ('3f000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1',
      '2f000000-0000-0000-0000-000000000001', '{oil_change}', '2026-10-01', 10, 'ffffffff-0000-0000-0000-000000000000')
    on conflict (id) do update set odometer_km = excluded.odometer_km$$,
  '42501', null,
  'a sync upsert that changes the reading is refused'
);
select lives_ok(
  $$update public.service_records set odometer_km = 47000, cost_cents = 5000
    where id = '3f000000-0000-0000-0000-000000000002'$$,
  'the customer still edits every field of a record they logged'
);
select lives_ok(
  $$update public.service_records set deleted_at = now() where vehicle_id = '2f000000-0000-0000-0000-000000000001'$$,
  'deleting the vehicle''s history soft-deletes shop-logged records too'
);

-- The shop's staff --------------------------------------------------------------
reset role;
update public.service_records set deleted_at = null where id = '3f000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000fa", "role": "authenticated"}', true);

select lives_ok(
  $$update public.service_records set odometer_km = 49100 where id = '3f000000-0000-0000-0000-000000000001'$$,
  'staff can still correct their shop''s record'
);

reset role;
select is(
  (select (notes, odometer_km, cost_cents, performed_on)::text from public.service_records
   where id = '3f000000-0000-0000-0000-000000000001'),
  ('Noise is gone', 49100, 8999, '2026-10-01'::date)::text,
  'only the customer''s notes and the staff correction changed the shop-logged record'
);
select is(
  (select created_at from public.service_records where id = '3f000000-0000-0000-0000-000000000001'),
  '2026-10-01 12:00:00.123456+00'::timestamptz,
  'a synced-back created_at keeps the stored value'
);

select * from finish();
rollback;
