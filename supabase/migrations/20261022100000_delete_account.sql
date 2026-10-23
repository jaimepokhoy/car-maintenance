-- "Delete account and all data" from inside the app (App Store guideline 5.1.1(v)).
--
-- Deleting the auth.users row is enough: every user-owned table references it
-- with on delete cascade (vehicles, service_records, maintenance_intervals,
-- shops, customer_links, push_tokens, tenant_staff), and campaigns.created_by
-- is set to null so a shop keeps its campaign history. Sessions and refresh
-- tokens in the auth schema cascade too, so the account is signed out everywhere.

create function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
begin
  if me is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = me;
end;
$$;

revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;
