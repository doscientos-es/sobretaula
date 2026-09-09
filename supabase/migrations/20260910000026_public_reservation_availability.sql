-- Disponibilidad pública real para que el cliente no tenga que intentar horas
-- ocupadas. La creación sigue validando todo dentro de una transacción.

create or replace function public.public_reservation_availability(
  p_slug text,
  p_service_id uuid,
  p_date date,
  p_party_size integer
)
returns table (starts_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  with target as (
    select t.id as tenant_id, t.timezone, s.id as service_id, s.venue_id,
      s.starts_at_time, s.ends_at_time, ar.slot_minutes, ar.min_lead_minutes,
      ar.max_lead_days, ar.max_covers_per_slot, ar.max_reservations_per_slot,
      coalesce((select value::integer from jsonb_each_text(ar.duration_minutes_by_party)
        where key::integer >= p_party_size and value::integer > 0 order by key::integer limit 1), 120) as duration
    from public.tenants t join public.services s on s.tenant_id = t.id and s.is_active
    join public.availability_rules ar on ar.service_id = s.id
    where t.slug = p_slug and t.status in ('trial', 'active') and s.id = p_service_id
  ), candidates as (
    select target.*, (p_date + target.starts_at_time
      + (slots.n * target.slot_minutes) * interval '1 minute') at time zone target.timezone as starts_at,
      (p_date + target.starts_at_time
      + (slots.n * target.slot_minutes + target.duration) * interval '1 minute') at time zone target.timezone as ends_at
    from target cross join lateral generate_series(
      0, greatest(0, floor(extract(epoch from (target.ends_at_time - target.starts_at_time)) / 60
        - target.duration) / target.slot_minutes)::integer
    ) as slots(n)
  )
  select c.starts_at
  from candidates c
  where extract(dow from (c.starts_at at time zone c.timezone))::smallint =
    (select weekday from public.services where id = c.service_id)
    and c.starts_at >= now() + make_interval(mins => c.min_lead_minutes)
    and c.starts_at <= now() + make_interval(days => c.max_lead_days)
    and not exists (
      select 1 from public.closures cl where cl.tenant_id = c.tenant_id and cl.venue_id = c.venue_id
        and cl.period && tstzrange(c.starts_at, c.ends_at, '[)')
    )
    and (c.max_reservations_per_slot is null or (
      select count(*) from public.reservations r where r.tenant_id = c.tenant_id and r.venue_id = c.venue_id
        and r.status in ('pending', 'confirmed', 'seated')
        and r.starts_at >= date_trunc('hour', c.starts_at)
        and r.starts_at < date_trunc('hour', c.starts_at) + floor(extract(minute from c.starts_at) / c.slot_minutes)
          * c.slot_minutes * interval '1 minute'
          + c.slot_minutes * interval '1 minute'
    ) < c.max_reservations_per_slot)
    and (c.max_covers_per_slot is null or (
      select coalesce(sum(r.party_size), 0) from public.reservations r where r.tenant_id = c.tenant_id and r.venue_id = c.venue_id
        and r.status in ('pending', 'confirmed', 'seated')
        and r.starts_at >= date_trunc('hour', c.starts_at)
        and r.starts_at < date_trunc('hour', c.starts_at) + floor(extract(minute from c.starts_at) / c.slot_minutes)
          * c.slot_minutes * interval '1 minute' + c.slot_minutes * interval '1 minute'
    ) + p_party_size <= c.max_covers_per_slot)
    and exists (
      select 1 from public.tables tb where tb.tenant_id = c.tenant_id and tb.venue_id = c.venue_id
        and tb.is_active and tb.is_bookable and tb.max_seats >= p_party_size
        and (tb.min_seats is null or tb.min_seats <= p_party_size)
        and not exists (select 1 from public.reservation_tables rt where rt.tenant_id = c.tenant_id
          and rt.table_id = tb.id and rt.status in ('pending', 'confirmed', 'seated')
          and rt.period && tstzrange(c.starts_at, c.ends_at, '[)'))
    )
  order by c.starts_at;
$$;

revoke execute on function public.public_reservation_availability(text, uuid, date, integer) from public, authenticated;
grant execute on function public.public_reservation_availability(text, uuid, date, integer) to anon;
