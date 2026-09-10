create or replace function public.reschedule_public_reservation(p_token_hash text, p_starts_at timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_res public.reservations%rowtype;
  v_duration interval;
begin
  select r.* into v_res from public.reservations r
  where r.public_token_hash = p_token_hash and r.public_token_expires_at > now()
    and r.status in ('pending', 'confirmed') for update;
  if not found or p_starts_at <= now() then return false; end if;
  -- The reservation already stores its effective duration; preserve it when moving.
  v_duration := v_res.ends_at - v_res.starts_at;
  if exists (
    select 1 from public.scheduling_blocks b
    where b.tenant_id = v_res.tenant_id and b.venue_id = v_res.venue_id
      and b.visible_online and b.period && tstzrange(p_starts_at, p_starts_at + v_duration, '[)')
      and (b.area_id is null or b.area_id = v_res.area_id)
  ) then return false; end if;
  if exists (
    select 1 from public.reservation_tables rt
    where rt.reservation_id = v_res.id and rt.status in ('confirmed', 'seated')
      and exists (
        select 1 from public.reservation_tables other
        where other.table_id = rt.table_id and other.reservation_id <> v_res.id
          and other.status in ('confirmed', 'seated')
          and other.period && tstzrange(p_starts_at, p_starts_at + v_duration, '[)')
      )
  ) then return false; end if;
  update public.reservations set starts_at = p_starts_at, ends_at = p_starts_at + v_duration
  where id = v_res.id;
  update public.reservation_tables set period = tstzrange(p_starts_at, p_starts_at + v_duration, '[)')
  where reservation_id = v_res.id;
  return true;
exception when exclusion_violation then
  return false;
end;
$$;
revoke execute on function public.reschedule_public_reservation(text, timestamptz) from public, authenticated;
grant execute on function public.reschedule_public_reservation(text, timestamptz) to anon;
