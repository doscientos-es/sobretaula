-- A venue cannot have two active reservation services covering the same time
-- window on the same weekday. The application validates this for a friendly
-- message; the trigger closes the concurrent-write race as well.
create or replace function public.prevent_overlapping_services()
returns trigger
language plpgsql
as $$
begin
  if new.is_active and exists (
    select 1
    from public.services existing
    where existing.tenant_id = new.tenant_id
      and existing.venue_id = new.venue_id
      and existing.weekday = new.weekday
      and existing.is_active
      and existing.id <> new.id
      and existing.starts_at_time < new.ends_at_time
      and new.starts_at_time < existing.ends_at_time
  ) then
    raise exception 'reservation_service_time_overlap' using errcode = '23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists services_prevent_overlapping on public.services;
create trigger services_prevent_overlapping
before insert or update of tenant_id, venue_id, weekday, starts_at_time, ends_at_time, is_active
on public.services
for each row execute function public.prevent_overlapping_services();
