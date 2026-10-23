-- The shop's app records which shop a push token came from
-- (push_tokens.tenant_id), and it only knows its own slug. Expose the shop's
-- id on the public profile so the app can look it up. New columns go last so
-- the view can be replaced in place; its grants are kept.
create or replace view public.tenant_profiles with (security_invoker = false) as
  select slug, name, brand, phone, email, address, latitude, longitude, hours,
    booking_url, website_url, updated_at, id
  from public.tenants
  where status = 'active';
