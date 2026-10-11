-- Initial schema for the car maintenance app.
--
-- Conventions:
-- * Every row belongs to one user (user_id defaults to auth.uid()) and RLS
--   limits each user to their own rows.
-- * IDs are client-generated UUIDs so records can be created offline.
-- * updated_at drives sync; deleted_at is a soft delete so deletions sync too.
-- * Distances are kilometres, money is integer cents.

create table public.vehicles (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nickname text not null,
  year smallint not null check (year between 1900 and 2100),
  make text not null,
  model text not null,
  vin text check (vin is null or char_length(vin) = 17),
  powertrain text not null check (powertrain in ('gas', 'hybrid', 'ev')),
  odometer_km integer not null check (odometer_km >= 0),
  odometer_updated_on date not null,
  tire_set text check (tire_set in ('winter', 'all_season', 'summer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Per-vehicle overrides of the default schedule (see src/domain/schedules.ts).
create table public.maintenance_intervals (
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  item_id text not null,
  every_km integer check (every_km > 0),
  every_months smallint check (every_months > 0),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  primary key (vehicle_id, item_id),
  check (every_km is not null or every_months is not null)
);

-- Shops the user saved or logged a service at. Details are a snapshot so the
-- service history still reads correctly if the places listing changes.
create table public.shops (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  place_id text,
  name text not null,
  address text,
  phone text,
  latitude double precision,
  longitude double precision,
  is_favourite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.service_records (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  item_ids text[] not null check (cardinality(item_ids) > 0),
  performed_on date not null,
  odometer_km integer not null check (odometer_km >= 0),
  cost_cents integer check (cost_cents >= 0),
  currency text check (currency in ('CAD', 'USD')),
  shop_id uuid references public.shops (id) on delete set null,
  notes text,
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index service_records_vehicle_idx on public.service_records (vehicle_id, performed_on desc);
create index vehicles_user_updated_idx on public.vehicles (user_id, updated_at);
create index service_records_user_updated_idx on public.service_records (user_id, updated_at);
create index shops_user_updated_idx on public.shops (user_id, updated_at);
create index maintenance_intervals_user_updated_idx on public.maintenance_intervals (user_id, updated_at);

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['vehicles', 'maintenance_intervals', 'shops', 'service_records'] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "Owners manage their own rows" on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;
end;
$$;

-- Receipt photos live at receipts/<user_id>/<file>, private to their owner.
insert into storage.buckets (id, name, public) values ('receipts', 'receipts', false);

create policy "Owners manage their own receipts" on storage.objects for all to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
