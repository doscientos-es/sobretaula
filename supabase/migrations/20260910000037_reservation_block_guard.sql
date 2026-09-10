-- Defensa final contra reservas que omitan el endpoint de disponibilidad.
create or replace function public.guard_reservation_scheduling_blocks()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'web' and exists (
    select 1 from public.scheduling_blocks sb
    where sb.tenant_id = new.tenant_id and sb.venue_id = new.venue_id
      and sb.visible_online and sb.period && tstzrange(new.starts_at, new.ends_at, '[)')
  ) then
    raise exception 'reservation_blocked' using errcode = '23P01';
  end if;
  return new;
end;
$$;
create trigger reservations_guard_scheduling_blocks
  before insert on public.reservations
  for each row execute function public.guard_reservation_scheduling_blocks();
