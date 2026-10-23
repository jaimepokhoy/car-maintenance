-- A service record a shop logged (created_by_tenant_id set) is the shop's
-- account of the work. The customer who owns it may change only their notes
-- and soft-delete it (deleting a vehicle soft-deletes its history); the
-- work, date, reading, cost and the shop stamp stay as the shop wrote them.
--
-- Sync upserts full rows, so a re-sent row with unchanged values passes.
-- created_at goes through the device at millisecond precision, so it is kept
-- from the stored row instead of compared. Shop staff, and server-side writes
-- with no signed-in user (such as `on delete set null` when a tenant goes),
-- are not limited here; their own policies apply.

create function public.guard_shop_record_fields() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.created_by_tenant_id is null
    or (select auth.uid()) is null
    or public.is_tenant_staff(old.created_by_tenant_id) then
    return new;
  end if;
  if (new.user_id, new.vehicle_id, new.item_ids, new.performed_on, new.odometer_km,
      new.cost_cents, new.currency, new.shop_id, new.receipt_path, new.created_by_tenant_id)
    is distinct from
     (old.user_id, old.vehicle_id, old.item_ids, old.performed_on, old.odometer_km,
      old.cost_cents, old.currency, old.shop_id, old.receipt_path, old.created_by_tenant_id) then
    raise exception 'only the notes of a service record a shop logged can be changed'
      using errcode = '42501';
  end if;
  new.created_at = old.created_at;
  return new;
end;
$$;

create trigger guard_shop_record_fields before update on public.service_records
  for each row execute function public.guard_shop_record_fields();
