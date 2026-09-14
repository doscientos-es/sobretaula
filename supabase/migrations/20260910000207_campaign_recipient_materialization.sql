alter table public.guests
  add column if not exists marketing_consent boolean not null default false;

create index if not exists guests_marketing_consent_idx
  on public.guests (tenant_id) where marketing_consent = true;

create or replace function public.send_guest_campaign(p_campaign_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign public.guest_campaigns%rowtype;
  v_segment text;
  v_count integer;
begin
  select * into v_campaign
    from public.guest_campaigns
   where id = p_campaign_id
   for update;
  if not found then raise exception 'campaign_not_found'; end if;
  if not public.has_tenant_role(v_campaign.tenant_id, array['owner', 'manager']::public.tenant_role[]) then
    raise exception 'forbidden';
  end if;
  if v_campaign.status not in ('draft', 'scheduled') then
    raise exception 'campaign_invalid_transition';
  end if;
  v_segment := coalesce(v_campaign.audience_filter->>'segment', 'nuevo');

  insert into public.guest_campaign_recipients (tenant_id, campaign_id, guest_id, consented, status, sent_at)
  select g.tenant_id, v_campaign.id, g.id, true, 'sent', now()
    from public.guests g
   where g.tenant_id = v_campaign.tenant_id
     and g.marketing_consent
     and ((v_campaign.channel = 'email' and nullif(btrim(g.email), '') is not null)
       or (v_campaign.channel in ('sms', 'whatsapp') and nullif(btrim(g.phone), '') is not null))
     and case v_segment
       when 'nuevo' then not exists (select 1 from public.reservations r where r.guest_id = g.id and r.status = 'completed')
       when 'inactivo' then exists (select 1 from public.reservations r where r.guest_id = g.id and r.status = 'completed')
         and not exists (select 1 from public.reservations r where r.guest_id = g.id and r.status = 'completed' and r.starts_at >= now() - interval '90 days')
       when 'habitual' then (select count(*) from public.reservations r where r.guest_id = g.id and r.status = 'completed') >= 3
       when 'vip' then (select count(*) from public.reservations r where r.guest_id = g.id and r.status = 'completed') >= 12
         or (select coalesce(sum(p.amount_cents), 0) from public.payments p join public.table_sessions s on s.id = p.session_id join public.reservations r on r.id = s.reservation_id where r.guest_id = g.id) >= 100000
       else false
     end
  on conflict (campaign_id, guest_id) do nothing;

  update public.guest_campaigns set status = 'sent', sent_at = now() where id = v_campaign.id;
  select count(*) into v_count from public.guest_campaign_recipients where campaign_id = v_campaign.id;
  return v_count;
end;
$$;

revoke all on function public.send_guest_campaign(uuid) from public;
grant execute on function public.send_guest_campaign(uuid) to authenticated;
