-- Identidad visual sencilla y compartida por superficies públicas.
alter table public.tenant_email_branding
  add column if not exists accent_color text not null default '#c34d3e'
    check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column if not exists preset text not null default 'terracotta'
    check (preset in ('terracotta', 'olive', 'ocean', 'midnight', 'custom'));

drop function if exists public.public_reservation_profile(text);
create function public.public_reservation_profile(p_slug text)
returns table (
  tenant_id uuid, tenant_name text, tenant_slug text, default_locale public.app_locale,
  timezone text, venue_id uuid, venue_name text, venue_slug text, service_id uuid,
  service_name text, weekday smallint, starts_at_time time, ends_at_time time,
  slot_minutes smallint, logo_url text, primary_color text, accent_color text, preset text
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.name, t.slug, t.default_locale, t.timezone,
    v.id, v.name, v.slug, s.id, s.name, s.weekday, s.starts_at_time, s.ends_at_time,
    coalesce(ar.slot_minutes, 15), b.logo_url, coalesce(b.primary_color, '#0f766e'),
    coalesce(b.accent_color, '#c34d3e'), coalesce(b.preset, 'terracotta')
  from public.tenants t
  join public.venues v on v.tenant_id = t.id and v.is_active
  left join public.services s on s.tenant_id = t.id and s.venue_id = v.id and s.is_active
  left join public.availability_rules ar on ar.service_id = s.id
  left join public.tenant_email_branding b on b.tenant_id = t.id
  where t.slug = p_slug and t.status in ('trial', 'active')
    and v.id = (select first_venue.id from public.venues first_venue
      where first_venue.tenant_id = t.id and first_venue.is_active
      order by first_venue.created_at, first_venue.id limit 1)
  order by v.name, s.weekday nulls first, s.starts_at_time;
$$;
grant execute on function public.public_reservation_profile(text) to anon;
