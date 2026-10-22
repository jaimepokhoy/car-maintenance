-- Multi-tenant backend for white-label shop apps.
--
-- Every shop is a row in tenants. Customer data stays user-owned: a shop's
-- staff see a customer's vehicles and history only while that customer has a
-- live (non-revoked, non-deleted) customer_links row for the shop. The
-- existing "Owners manage their own rows" policies are unchanged; the
-- policies below only add access.

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  name text not null,
  status text not null default 'active' check (status in ('active', 'suspended')),
  -- { "accent"?, "onAccent"?, "logoUrl"? }
  brand jsonb not null default '{}' check (jsonb_typeof(brand) = 'object'),
  phone text,
  email text,
  address text,
  latitude double precision,
  longitude double precision,
  -- [{ "day": 0-6 (0 = Sunday), "opens": "HH:MM", "closes": "HH:MM" }]
  hours jsonb check (hours is null or jsonb_typeof(hours) = 'array'),
  booking_url text,
  website_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_staff (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'staff')),
  primary key (tenant_id, user_id)
);

create index tenant_staff_user_idx on public.tenant_staff (user_id);

-- A customer's consent to share their data with one shop. Created on the
-- consent screen in the shop's app; revoking sets revoked_at.
create table public.customer_links (
  id uuid primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  consented_at timestamptz not null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, user_id)
);

create index customer_links_user_updated_idx on public.customer_links (user_id, updated_at);

-- Shop-created records keep the customer's user_id so they sync down through
-- the normal path; this column says which shop wrote them.
alter table public.service_records
  add column created_by_tenant_id uuid references public.tenants (id) on delete set null;

-- Expo push tokens. tenant_id is the shop app the token was registered from
-- (null in the unbranded app).
create table public.push_tokens (
  token text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tenant_id uuid references public.tenants (id) on delete set null,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_updated_idx on public.push_tokens (user_id, updated_at);
create index push_tokens_tenant_idx on public.push_tokens (tenant_id);

-- Reminders and promotions a shop sends to its linked customers.
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  title text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all', 'due_soon')),
  status text not null default 'draft' check (status in ('draft', 'sent')),
  sent_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index campaigns_tenant_updated_idx on public.campaigns (tenant_id, updated_at);

do $$
declare t text;
begin
  foreach t in array array['tenants', 'customer_links', 'push_tokens', 'campaigns'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end;
$$;

-- Helpers for policies. Security definer so they can read tenant_staff and
-- customer_links without recursing through those tables' own policies.

create function public.is_tenant_staff(tenant uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_staff
    where tenant_id = tenant and user_id = (select auth.uid())
  );
$$;

create function public.is_linked_customer(tenant uuid, customer uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.customer_links
    where tenant_id = tenant and user_id = customer
      and revoked_at is null and deleted_at is null
  );
$$;

revoke execute on function public.is_tenant_staff(uuid) from public, anon;
revoke execute on function public.is_linked_customer(uuid, uuid) from public, anon;
grant execute on function public.is_tenant_staff(uuid) to authenticated, service_role;
grant execute on function public.is_linked_customer(uuid, uuid) to authenticated, service_role;

-- Tenants. Rows are created by us at onboarding (service role). Staff read
-- and edit their own shop's profile, but not its slug or status.
alter table public.tenants enable row level security;

revoke all on public.tenants from anon, authenticated;
grant select on public.tenants to authenticated;
grant update (name, brand, phone, email, address, latitude, longitude, hours, booking_url, website_url)
  on public.tenants to authenticated;

create policy "Staff read their tenant" on public.tenants for select to authenticated
  using (public.is_tenant_staff(id));

create policy "Staff edit their tenant" on public.tenants for update to authenticated
  using (public.is_tenant_staff(id)) with check (public.is_tenant_staff(id));

-- Public shop profile, read by the shop's app before anyone signs in. Runs
-- with the owner's rights (security_invoker off) so it can bypass tenants RLS;
-- it exposes only active shops and only these columns, and is read-only.
create view public.tenant_profiles with (security_invoker = false) as
  select slug, name, brand, phone, email, address, latitude, longitude, hours,
    booking_url, website_url, updated_at
  from public.tenants
  where status = 'active';

revoke all on public.tenant_profiles from anon, authenticated;
grant select on public.tenant_profiles to anon, authenticated;

-- Staff membership is managed by us; staff can see who else works at their shop.
alter table public.tenant_staff enable row level security;

create policy "Staff read their tenant's staff" on public.tenant_staff for select to authenticated
  using (user_id = (select auth.uid()) or public.is_tenant_staff(tenant_id));

-- Customer links: the customer manages their own; staff read their shop's.
alter table public.customer_links enable row level security;

create policy "Owners manage their own rows" on public.customer_links for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "Staff read their tenant's links" on public.customer_links for select to authenticated
  using (public.is_tenant_staff(tenant_id));

-- Staff read the data of customers linked to their shop.
do $$
declare t text;
begin
  foreach t in array array['vehicles', 'maintenance_intervals', 'shops', 'service_records'] loop
    execute format(
      'create policy "Staff read linked customers'' rows" on public.%1$I for select to authenticated '
      'using (exists (select 1 from public.tenant_staff s '
      'where s.user_id = (select auth.uid()) and public.is_linked_customer(s.tenant_id, %1$I.user_id)))',
      t
    );
  end loop;
end;
$$;

-- Staff write service records for linked customers, marked as their shop's,
-- on one of that customer's vehicles (and shops, if set).
create policy "Staff insert linked customers' service records" on public.service_records
  for insert to authenticated
  with check (
    created_by_tenant_id is not null
    and public.is_tenant_staff(created_by_tenant_id)
    and public.is_linked_customer(created_by_tenant_id, user_id)
    and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = service_records.user_id)
    and (shop_id is null or exists (select 1 from public.shops s where s.id = shop_id and s.user_id = service_records.user_id))
  );

create policy "Staff update their tenant's service records" on public.service_records
  for update to authenticated
  using (
    created_by_tenant_id is not null
    and public.is_tenant_staff(created_by_tenant_id)
    and public.is_linked_customer(created_by_tenant_id, user_id)
  )
  with check (
    created_by_tenant_id is not null
    and public.is_tenant_staff(created_by_tenant_id)
    and public.is_linked_customer(created_by_tenant_id, user_id)
    and exists (select 1 from public.vehicles v where v.id = vehicle_id and v.user_id = service_records.user_id)
    and (shop_id is null or exists (select 1 from public.shops s where s.id = shop_id and s.user_id = service_records.user_id))
  );

-- The owner policy lets a customer write any column of their own records, so
-- stop them from marking a record as shop-created. Re-sending an existing
-- shop record unchanged (sync upsert) is allowed.
create function public.guard_created_by_tenant() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.created_by_tenant_id is null or (select auth.uid()) is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.created_by_tenant_id is not distinct from old.created_by_tenant_id then
    return new;
  end if;
  if tg_op = 'INSERT' and exists (
    select 1 from public.service_records r
    where r.id = new.id and r.created_by_tenant_id = new.created_by_tenant_id
  ) then
    return new;
  end if;
  if not public.is_tenant_staff(new.created_by_tenant_id) then
    raise exception 'only staff of a tenant can mark a service record as created by it'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger guard_created_by_tenant before insert or update on public.service_records
  for each row execute function public.guard_created_by_tenant();

-- Push tokens belong to the device's user. Sending uses the service role.
alter table public.push_tokens enable row level security;

create policy "Owners manage their own rows" on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Campaigns: staff manage their shop's.
alter table public.campaigns enable row level security;

create policy "Staff manage their tenant's campaigns" on public.campaigns for all to authenticated
  using (public.is_tenant_staff(tenant_id)) with check (public.is_tenant_staff(tenant_id));

-- Shop logos and other branding at tenant-assets/<tenant_id>/<file>. Public
-- read by URL; staff write under their own tenant's folder.
insert into storage.buckets (id, name, public) values ('tenant-assets', 'tenant-assets', true);

create policy "Staff manage their tenant's assets" on storage.objects for all to authenticated
  using (
    bucket_id = 'tenant-assets'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.tenant_staff where user_id = (select auth.uid())
    )
  )
  with check (
    bucket_id = 'tenant-assets'
    and (storage.foldername(name))[1] in (
      select tenant_id::text from public.tenant_staff where user_id = (select auth.uid())
    )
  );
