-- Extensión compatible del flujo público con área opcional.
create or replace function public.public_reservation_areas(p_slug text)
returns table (area_id uuid, area_name text)
language sql stable security definer set search_path = '' as $$
  select a.id, a.name
  from public.tenants t
  join public.venues v on v.tenant_id = t.id and v.is_active
  join public.areas a on a.venue_id = v.id and a.tenant_id = t.id and a.is_online_bookable
  where t.slug = p_slug and t.status in ('trial', 'active')
    and v.id = (select vv.id from public.venues vv where vv.tenant_id = t.id and vv.is_active order by vv.created_at, vv.id limit 1)
  order by a.name;
$$;
grant execute on function public.public_reservation_areas(text) to anon;

create or replace function public.create_public_reservation_in_area(
  p_slug text, p_service_id uuid, p_starts_at timestamptz, p_party_size integer,
  p_guest_name text, p_guest_email text, p_guest_phone text,
  p_public_token_hash text, p_area_id uuid
)
returns table (reservation_id uuid, starts_at timestamptz, ends_at timestamptz, venue_name text)
language plpgsql security definer set search_path = public as $$
declare created_row record; target_table uuid;
begin
  if not exists (select 1 from areas where id = p_area_id and is_online_bookable) then raise exception 'public_area_not_found' using errcode = 'P0002'; end if;
  select * into created_row from public.create_public_reservation(p_slug, p_service_id, p_starts_at, p_party_size, p_guest_name, p_guest_email, p_guest_phone, p_public_token_hash);
  select t.id into target_table from public.tables t
  where t.area_id = p_area_id and t.is_active and t.is_bookable and t.max_seats >= p_party_size
    and (t.min_seats is null or t.min_seats <= p_party_size)
    and not exists (select 1 from public.reservation_tables rt where rt.table_id = t.id and rt.status in ('pending','confirmed','seated') and rt.period && tstzrange(created_row.starts_at, created_row.ends_at, '[)'))
  order by t.max_seats, t.id limit 1 for update;
  if target_table is null then raise exception 'public_slot_unavailable' using errcode = '23P01'; end if;
  update public.reservations set area_id = p_area_id where id = created_row.reservation_id;
  delete from public.reservation_tables where reservation_id = created_row.reservation_id;
  insert into public.reservation_tables (tenant_id, reservation_id, table_id, status, period)
    select r.tenant_id, r.id, target_table, r.status, tstzrange(r.starts_at, r.ends_at, '[)') from public.reservations r where r.id = created_row.reservation_id;
  return query select created_row.reservation_id, created_row.starts_at, created_row.ends_at, created_row.venue_name;
end;
$$;
grant execute on function public.create_public_reservation_in_area(text, uuid, timestamptz, integer, text, text, text, text, uuid) to anon;
