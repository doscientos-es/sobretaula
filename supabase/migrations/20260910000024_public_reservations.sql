-- MVP público de reservas. Expone únicamente disponibilidad operativa y crea
-- la reserva dentro de una función SECURITY DEFINER; el visitante anónimo no
-- obtiene acceso directo a las tablas privadas.

create or replace function public.public_reservation_profile(p_slug text)
returns table (
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  timezone text,
  venue_id uuid,
  venue_name text,
  venue_slug text,
  service_id uuid,
  service_name text,
  weekday smallint,
  starts_at_time time,
  ends_at_time time,
  slot_minutes smallint
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.slug, t.timezone,
    v.id, v.name, v.slug, s.id, s.name, s.weekday,
    s.starts_at_time, s.ends_at_time, coalesce(ar.slot_minutes, 15)
  from public.tenants t
  join public.venues v on v.tenant_id = t.id and v.is_active
  left join public.services s on s.tenant_id = t.id and s.venue_id = v.id and s.is_active
  left join public.availability_rules ar on ar.service_id = s.id
  where t.slug = p_slug and t.status in ('trial', 'active')
    -- MVP: el enlace público representa el primer local activo. El selector
    -- multi-local se añadirá cuando exista una necesidad real de grupos.
    and v.id = (
      select first_venue.id from public.venues first_venue
      where first_venue.tenant_id = t.id and first_venue.is_active
      order by first_venue.created_at, first_venue.id limit 1
    )
  order by v.name, s.weekday nulls first, s.starts_at_time;
$$;

create or replace function public.create_public_reservation(
  p_slug text,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_party_size integer,
  p_guest_name text,
  p_guest_email text default null,
  p_guest_phone text default null
)
returns table (reservation_id uuid, starts_at timestamptz, ends_at timestamptz, venue_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant record;
  v_service record;
  v_rule record;
  v_table record;
  v_guest_id uuid;
  v_local_start timestamp;
  v_local_end timestamp;
  v_ends_at timestamptz;
  v_duration integer;
  v_reservation_id uuid;
  v_slot_start timestamptz;
  v_reservations integer;
  v_covers integer;
begin
  if p_party_size is null or p_party_size < 1 or p_party_size > 50
    or p_guest_name is null or length(btrim(p_guest_name)) = 0
    or (p_guest_email is null and p_guest_phone is null) then
    raise exception 'invalid_public_reservation' using errcode = '22023';
  end if;

  select t.id, t.name, t.timezone into v_tenant
  from public.tenants t
  where t.slug = p_slug and t.status in ('trial', 'active');
  if not found then raise exception 'public_restaurant_not_found' using errcode = 'P0002'; end if;

  select s.*, v.name as venue_name into v_service
  from public.services s
  join public.venues v on v.id = s.venue_id and v.tenant_id = s.tenant_id and v.is_active
  where s.id = p_service_id and s.tenant_id = v_tenant.id and s.is_active;
  if not found then raise exception 'public_service_not_found' using errcode = 'P0002'; end if;

  select * into v_rule from public.availability_rules where service_id = v_service.id;
  if not found then
    raise exception 'public_service_not_configured' using errcode = 'P0002';
  end if;
  v_local_start := p_starts_at at time zone v_tenant.timezone;
  if extract(dow from v_local_start)::smallint <> v_service.weekday
    or v_local_start::time < v_service.starts_at_time
    or v_local_start::time >= v_service.ends_at_time then
    raise exception 'public_slot_outside_service' using errcode = '22023';
  end if;
  if v_rule.min_lead_minutes is not null
    and p_starts_at < now() + make_interval(mins => v_rule.min_lead_minutes) then
    raise exception 'public_slot_too_soon' using errcode = '22023';
  end if;
  if v_rule.max_lead_days is not null
    and p_starts_at > now() + make_interval(days => v_rule.max_lead_days) then
    raise exception 'public_slot_too_far' using errcode = '22023';
  end if;

  select coalesce(
    (select value::integer from jsonb_each_text(v_rule.duration_minutes_by_party)
      where key::integer >= p_party_size and value::integer > 0
      order by key::integer limit 1),
    120
  ) into v_duration;
  v_local_end := v_local_start + make_interval(mins => v_duration);
  if v_local_end::time > v_service.ends_at_time and v_local_end::date = v_local_start::date then
    raise exception 'public_slot_outside_service' using errcode = '22023';
  end if;
  v_ends_at := v_local_end at time zone v_tenant.timezone;
  v_slot_start := date_trunc('hour', p_starts_at)
    + floor(extract(minute from p_starts_at) / greatest(1, coalesce(v_rule.slot_minutes, 15)))
      * greatest(1, coalesce(v_rule.slot_minutes, 15)) * interval '1 minute';

  select count(*), coalesce(sum(r.party_size), 0) into v_reservations, v_covers
  from public.reservations r
  where r.tenant_id = v_tenant.id and r.venue_id = v_service.venue_id
    and r.status in ('pending', 'confirmed', 'seated')
    and r.starts_at >= v_slot_start
    and r.starts_at < v_slot_start + greatest(1, coalesce(v_rule.slot_minutes, 15)) * interval '1 minute';
  if v_rule.max_reservations_per_slot is not null and v_reservations >= v_rule.max_reservations_per_slot then
    raise exception 'public_slot_unavailable' using errcode = '23P01';
  end if;
  if v_rule.max_covers_per_slot is not null and v_covers + p_party_size > v_rule.max_covers_per_slot then
    raise exception 'public_slot_unavailable' using errcode = '23P01';
  end if;
  if exists (
    select 1 from public.closures c
    where c.tenant_id = v_tenant.id and c.venue_id = v_service.venue_id
      and c.period && tstzrange(p_starts_at, v_ends_at, '[)')
  ) then
    raise exception 'public_slot_unavailable' using errcode = '23P01';
  end if;

  select t.id, t.max_seats, t.min_seats into v_table
  from public.tables t
  where t.tenant_id = v_tenant.id and t.venue_id = v_service.venue_id
    and t.is_active and t.is_bookable and t.max_seats >= p_party_size
    and (t.min_seats is null or t.min_seats <= p_party_size)
    and not exists (
      select 1 from public.reservation_tables rt
      where rt.table_id = t.id and rt.tenant_id = v_tenant.id
        and rt.status in ('pending', 'confirmed', 'seated')
        and rt.period && tstzrange(p_starts_at, v_ends_at, '[)')
    )
  order by t.max_seats, t.id
  limit 1
  for update;
  if not found then raise exception 'public_slot_unavailable' using errcode = '23P01'; end if;

  if p_guest_email is not null then
    select id into v_guest_id from public.guests
    where tenant_id = v_tenant.id and lower(email) = lower(btrim(p_guest_email)) limit 1;
  end if;
  if v_guest_id is null and p_guest_phone is not null then
    select id into v_guest_id from public.guests
    where tenant_id = v_tenant.id and phone = btrim(p_guest_phone) limit 1;
  end if;
  if v_guest_id is null then
    insert into public.guests (tenant_id, full_name, email, phone)
    values (v_tenant.id, btrim(p_guest_name), nullif(lower(btrim(p_guest_email)), ''), nullif(btrim(p_guest_phone), ''))
    returning id into v_guest_id;
  else
    update public.guests set full_name = btrim(p_guest_name),
      email = coalesce(nullif(lower(btrim(p_guest_email)), ''), email),
      phone = coalesce(nullif(btrim(p_guest_phone), ''), phone)
    where id = v_guest_id;
  end if;

  insert into public.reservations (
    tenant_id, venue_id, guest_id, party_size, starts_at, ends_at, status, source
  ) values (
    v_tenant.id, v_service.venue_id, v_guest_id, p_party_size, p_starts_at, v_ends_at, 'pending', 'web'
  ) returning id into v_reservation_id;
  begin
    insert into public.reservation_tables (tenant_id, reservation_id, table_id, status, period)
    values (v_tenant.id, v_reservation_id, v_table.id, 'pending', tstzrange(p_starts_at, v_ends_at, '[)'));
  exception when exclusion_violation then
    raise exception 'public_slot_unavailable' using errcode = '23P01';
  end;
  return query select v_reservation_id, p_starts_at, v_ends_at, v_service.venue_name;
end;
$$;

revoke execute on function public.public_reservation_profile(text) from public, authenticated;
grant execute on function public.public_reservation_profile(text) to anon;
revoke execute on function public.create_public_reservation(text, uuid, timestamptz, integer, text, text, text) from public, authenticated;
grant execute on function public.create_public_reservation(text, uuid, timestamptz, integer, text, text, text) to anon;
