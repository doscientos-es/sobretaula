-- Evolución compatible de la lista de espera: puerta inmediata y solicitudes futuras.

alter table public.waitlist
  add column if not exists status text not null default 'waiting'
    check (status in ('waiting', 'offered', 'accepted', 'expired', 'cancelled', 'seated')),
  add column if not exists service_id uuid references public.services (id) on delete set null,
  add column if not exists preferred_area_id uuid references public.areas (id) on delete set null,
  add column if not exists expires_at timestamptz,
  add column if not exists reservation_id uuid references public.reservations (id) on delete set null,
  add column if not exists offer_expires_at timestamptz,
  add column if not exists exit_reason text;

alter table public.waitlist
  add constraint waitlist_expiry_after_request check (expires_at is null or expires_at >= requested_for),
  add constraint waitlist_offer_expiry_check check (offer_expires_at is null or status = 'offered');

create index waitlist_future_queue_idx
  on public.waitlist (tenant_id, venue_id, requested_for, created_at)
  where status = 'waiting';

create unique index waitlist_one_active_offer_idx
  on public.waitlist (tenant_id, guest_id)
  where status = 'offered' and guest_id is not null;

create or replace function public.offer_waitlist_entry(p_tenant_id uuid, p_entry_id uuid, p_minutes integer default 15)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_tenant_member(p_tenant_id) then raise exception 'forbidden'; end if;
  update public.waitlist
  set status = 'offered', offer_expires_at = now() + make_interval(mins => greatest(1, least(p_minutes, 120)))
  where id = p_entry_id and tenant_id = p_tenant_id and status = 'waiting';
  return found;
end;
$$;
grant execute on function public.offer_waitlist_entry(uuid, uuid, integer) to authenticated;

create or replace function public.expire_waitlist_offers()
returns integer language plpgsql security definer set search_path = public as $$
declare affected integer;
begin
  update public.waitlist set status = 'expired', exit_reason = 'offer_expired'
  where status = 'offered' and offer_expires_at < now();
  get diagnostics affected = row_count;
  return affected;
end;
$$;
revoke execute on function public.expire_waitlist_offers() from public, anon, authenticated;
grant execute on function public.expire_waitlist_offers() to service_role;
