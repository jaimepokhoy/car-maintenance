-- Tests for public.register_push_token() (20261022210000_register_push_token.sql)
-- and the shop id on tenant_profiles (20261022200000_tenant_profile_id.sql).
-- Run with `npx supabase test db` against a local stack.

begin;
create extension if not exists pgtap with schema extensions;

select plan(14);

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-000000000001', 'first@test.ca', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'second@test.ca', 'authenticated', 'authenticated');

insert into public.tenants (id, slug, name, status) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'shop-a', 'Shop A', 'active'),
  ('cccccccc-0000-0000-0000-000000000000', 'shop-c', 'Shop C', 'suspended');

-- The public profile carries the shop id, for active shops only.
set local role anon;
select results_eq(
  $$select id from public.tenant_profiles where slug in ('shop-a', 'shop-c') order by slug$$,
  $$values ('aaaaaaaa-0000-0000-0000-000000000000'::uuid)$$,
  'anon reads the id of active shops only'
);

-- Anonymous callers can't register.
select throws_ok(
  $$select public.register_push_token('ExponentPushToken[phone]', 'ios', null)$$,
  '42501', null, 'anon cannot register a token'
);

-- Signed in, but no user in the token.
set local role authenticated;
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select public.register_push_token('ExponentPushToken[phone]', 'ios', null)$$,
  '42501', 'sign in to register for push', 'no user, no token'
);

-- The first owner registers the phone from a branded build.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
select lives_ok(
  $$select public.register_push_token('ExponentPushToken[phone]', 'ios', 'aaaaaaaa-0000-0000-0000-000000000000')$$,
  'an owner registers their phone'
);
select results_eq(
  'select user_id, tenant_id, platform from public.push_tokens',
  $$values ('00000000-0000-0000-0000-000000000001'::uuid, 'aaaaaaaa-0000-0000-0000-000000000000'::uuid, 'ios')$$,
  'the row belongs to the caller and their shop'
);

-- Inputs the RLS policy would not have checked.
select throws_ok(
  $$select public.register_push_token('ExponentPushToken[other]', 'ios', 'cccccccc-0000-0000-0000-000000000000')$$,
  '22023', null, 'a suspended shop is refused'
);
select throws_ok(
  $$select public.register_push_token('ExponentPushToken[other]', 'ios', 'dddddddd-0000-0000-0000-000000000000')$$,
  '22023', null, 'an unknown shop is refused'
);
select throws_ok(
  $$select public.register_push_token('not a token', 'ios', null)$$,
  '22023', null, 'a value that is not an Expo token is refused'
);
select throws_ok(
  $$select public.register_push_token('ExponentPushToken[other]', 'web', null)$$,
  '23514', null, 'only iOS and Android'
);

-- The second owner signs in on the same phone without the first signing out.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000002", "role": "authenticated"}', true);
select is_empty('select 1 from public.push_tokens', 'the second owner cannot see the first owner''s row');
select lives_ok(
  $$select public.register_push_token('ExpoPushToken[phone]', 'android', null)$$,
  'a new-format token registers too'
);
select lives_ok(
  $$select public.register_push_token('ExponentPushToken[phone]', 'ios', null)$$,
  'the second owner takes the phone over'
);
select results_eq(
  $$select user_id, tenant_id from public.push_tokens where token = 'ExponentPushToken[phone]'$$,
  $$values ('00000000-0000-0000-0000-000000000002'::uuid, null::uuid)$$,
  'the phone now follows the second owner, with no shop'
);

-- The first owner can no longer delete it on a late sign-out.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);
delete from public.push_tokens where token = 'ExponentPushToken[phone]';
reset role;
select isnt_empty(
  $$select 1 from public.push_tokens where token = 'ExponentPushToken[phone]'$$,
  'a previous owner''s delete leaves the new owner''s row'
);

select * from finish();
rollback;
