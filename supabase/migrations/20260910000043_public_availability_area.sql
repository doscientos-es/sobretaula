create or replace function public.public_reservation_availability_for_area(
  p_slug text, p_service_id uuid, p_date date, p_party_size integer, p_area_id uuid
)
returns table (starts_at timestamptz)
language sql stable security definer set search_path = '' as $$
  with base as (select a.starts_at from public.public_reservation_availability(p_slug, p_service_id, p_date, p_party_size) a),
  target as (select t.id tenant_id, s.venue_id, t.timezone,
    coalesce((select value::integer from jsonb_each_text(ar.duration_minutes_by_party) where key::integer >= p_party_size and value::integer > 0 order by key::integer limit 1), 120) duration
    from public.tenants t join public.services s on s.tenant_id = t.id join public.availability_rules ar on ar.service_id = s.id
    where t.slug = p_slug and s.id = p_service_id limit 1)
  select b.starts_at from base b cross join target t
  where exists (select 1 from public.tables tb where tb.tenant_id = t.tenant_id and tb.venue_id = t.venue_id and tb.area_id = p_area_id and tb.is_active and tb.is_bookable and tb.max_seats >= p_party_size and (tb.min_seats is null or tb.min_seats <= p_party_size)
    and not exists (select 1 from public.reservation_tables rt where rt.tenant_id = t.tenant_id and rt.table_id = tb.id and rt.status in ('pending','confirmed','seated') and rt.period && tstzrange(b.starts_at, b.starts_at + t.duration * interval '1 minute', '[)')))
  order by b.starts_at;
$$;
grant execute on function public.public_reservation_availability_for_area(text, uuid, date, integer, uuid) to anon;
