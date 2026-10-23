-- Service reminders versus promotions.
--
-- A promotion is a commercial message, so it only goes to customers who
-- opted in to that shop's promotions. Linking to a shop (consented_at) is
-- consent to share vehicle data, not to receive offers. The customer sets
-- promotions_opt_in_at on their own link (the existing "Owners manage their
-- own rows" policy); staff can read it but not set it. The send-campaign
-- function filters on it.

alter table public.customer_links
  add column promotions_opt_in_at timestamptz;

-- Rows from before this column count as promotions, the stricter kind.
-- send-campaign always says which kind it is sending.
alter table public.campaigns
  add column kind text not null default 'promotion' check (kind in ('service_reminder', 'promotion'));

-- start_campaign now records the kind. Same rules as in
-- 20261022220000_campaign_sending.sql otherwise.
drop function public.start_campaign(uuid, uuid, text, text, text, uuid, integer, integer, interval, interval);

create function public.start_campaign(
  p_id uuid,
  p_tenant_id uuid,
  p_title text,
  p_body text,
  p_audience text,
  p_kind text,
  p_created_by uuid,
  p_recipient_count integer,
  p_limit integer,
  p_window interval,
  p_stale interval
) returns text
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.tenants where id = p_tenant_id and status = 'active' for update;
  if not found then
    raise exception 'shop % is missing or suspended', p_tenant_id using errcode = 'P0002';
  end if;

  if exists (select 1 from public.campaigns where id = p_id) then
    return 'duplicate';
  end if;

  if (
    select count(*) from public.campaigns
    where tenant_id = p_tenant_id
      and status = 'sent'
      and sent_at > now() - p_window
      and (sent_count > 0 or (sent_count is null and sent_at > now() - p_stale))
  ) >= p_limit then
    return 'rate_limited';
  end if;

  insert into public.campaigns (id, tenant_id, title, body, audience, kind, status, sent_at, created_by, recipient_count)
  values (p_id, p_tenant_id, p_title, p_body, p_audience, p_kind, 'sent', now(), p_created_by, p_recipient_count);
  return 'started';
end;
$$;

revoke execute on function public.start_campaign(uuid, uuid, text, text, text, text, uuid, integer, integer, interval, interval)
  from public, anon, authenticated;
grant execute on function public.start_campaign(uuid, uuid, text, text, text, text, uuid, integer, integer, interval, interval)
  to service_role;
