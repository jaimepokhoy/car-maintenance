-- Saves the caller's Expo push token. A token identifies a phone, not a
-- person: when someone signs in on a phone whose previous owner never signed
-- out (offline, expired session), the row still belongs to that owner and an
-- upsert fails RLS. This takes the token over for the caller instead, so
-- shop messages follow whoever is signed in now.
create function public.register_push_token(p_token text, p_platform text, p_tenant_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'sign in to register for push' using errcode = '42501';
  end if;
  insert into public.push_tokens (token, user_id, tenant_id, platform)
  values (p_token, (select auth.uid()), p_tenant_id, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, tenant_id = excluded.tenant_id, platform = excluded.platform;
end;
$$;

revoke execute on function public.register_push_token(text, text, uuid) from public, anon;
grant execute on function public.register_push_token(text, text, uuid) to authenticated;
