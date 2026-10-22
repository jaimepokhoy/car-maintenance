-- Tests for public.delete_account() (20261022100000_delete_account.sql).
-- Run with `npx supabase test db` against a local stack.

begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000001', 'leaving@test.ca', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'staying@test.ca', 'authenticated', 'authenticated');

insert into public.vehicles (id, user_id, nickname, year, make, model, powertrain, odometer_km, odometer_updated_on) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Leaving car', 2020, 'Honda', 'Civic', 'gas', 50000, '2026-10-01'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', 'Staying car', 2019, 'Toyota', 'RAV4', 'hybrid', 80000, '2026-10-01');

insert into public.service_records (id, user_id, vehicle_id, item_ids, performed_on, odometer_km) values
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '{oil_change}', '2026-10-01', 50000),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', '{oil_change}', '2026-10-01', 80000);

-- Anonymous callers can't run it at all.
set local role anon;
select throws_ok('select public.delete_account()', '42501', null, 'anon cannot delete an account');

-- A signed-in owner deletes only their own account and data.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select lives_ok('select public.delete_account()', 'an owner can delete their account');

reset role;
select is_empty($$select 1 from auth.users where id = '00000000-0000-0000-0000-000000000001'$$, 'the auth user is gone');
select is_empty($$select 1 from public.vehicles where user_id = '00000000-0000-0000-0000-000000000001'$$, 'their vehicles are gone');
select is_empty($$select 1 from public.service_records where user_id = '00000000-0000-0000-0000-000000000001'$$, 'their service records are gone');
select isnt_empty($$select 1 from auth.users where id = '00000000-0000-0000-0000-000000000002'$$, 'other users stay');
select isnt_empty($$select 1 from public.vehicles where user_id = '00000000-0000-0000-0000-000000000002'$$, 'other users'' vehicles stay');
select isnt_empty($$select 1 from public.service_records where user_id = '00000000-0000-0000-0000-000000000002'$$, 'other users'' records stay');

-- Without a signed-in user it refuses rather than doing nothing silently.
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok('select public.delete_account()', '42501', 'not signed in', 'no user, no delete');

select * from finish();
rollback;
