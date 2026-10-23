-- Saves the caller's Expo push token. A token identifies a phone, not a
-- person: when someone signs in on a phone whose previous owner never signed
-- out (offline, expired session), the row still belongs to that owner and an
-- upsert fails RLS. This takes the token over for the caller instead, so
-- shop messages follow whoever is signed in now.
--
-- Security definer bypasses RLS, so it checks its inputs itself: only Expo
-- push tokens, and only an active shop (or none) as the tenant, so a caller
-- can't tag their phone with a suspended or made-up shop.
create function public.register_push_token(p_token text, p_platform text, p_tenant_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'sign in to register for push' using errcode = '42501';
  end if;
  if p_token is null or length(p_token) > 255 or p_token !~ '^Expo(nent)?PushToken\[[^]]+\]$' then
    raise exception 'not an Expo push token' using errcode = '22023';
  end if;
  if p_tenant_id is not null and not exists (
    select 1 from public.tenants where id = p_tenant_id and status = 'active'
  ) then
    raise exception 'no active shop with that id' using errcode = '22023';
  end if;
  insert into public.push_tokens (token, user_id, tenant_id, platform)
  values (p_token, (select auth.uid()), p_tenant_id, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, tenant_id = excluded.tenant_id, platform = excluded.platform;
end;
$$;

revoke execute on function public.register_push_token(text, text, uuid) from public, anon;
grant execute on function public.register_push_token(text, text, uuid) to authenticated;
