-- Refuerzo de reservas públicas y ficha de cliente.
create table public.reservation_terms_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  version integer not null check (version > 0),
  locale public.app_locale not null default 'es',
  title text not null check (length(btrim(title)) between 1 and 160),
  body text not null check (length(btrim(body)) between 1 and 10000),
  published_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  unique (tenant_id, venue_id, version, locale)
);

alter table public.reservations
  add column if not exists terms_version_id uuid references public.reservation_terms_versions(id) on delete set null;

create table public.public_reservation_rate_limits (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  rate_key text not null check (rate_key ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default date_trunc('hour', now()),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, rate_key)
);

alter table public.public_reservation_rate_limits enable row level security;
alter table public.public_reservation_rate_limits force row level security;

create table public.guest_allergies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  allergen text not null check (length(btrim(allergen)) between 1 and 100),
  severity text not null default 'unknown' check (severity in ('unknown','mild','severe')),
  notes text,
  created_at timestamptz not null default now(),
  unique (tenant_id, guest_id, allergen)
);

create table public.guest_preferences (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  preference text not null check (length(btrim(preference)) between 1 and 120),
  notes text,
  created_at timestamptz not null default now(),
  unique (tenant_id, guest_id, preference)
);

create index reservation_terms_public_idx on public.reservation_terms_versions(tenant_id, venue_id, published_at desc);
create index guest_allergies_guest_idx on public.guest_allergies(tenant_id, guest_id);
create index guest_preferences_guest_idx on public.guest_preferences(tenant_id, guest_id);

select public.apply_tenant_rls('reservation_terms_versions', array['owner','manager']::public.tenant_role[]);
select public.apply_tenant_rls('guest_allergies', array['owner','manager','host','waiter']::public.tenant_role[]);
select public.apply_tenant_rls('guest_preferences', array['owner','manager','host','waiter']::public.tenant_role[]);

create or replace function public.public_reservation_terms(p_slug text)
returns table(id uuid, version integer, title text, body text, locale public.app_locale)
language sql stable security definer set search_path = public as $$
  select rt.id, rt.version, rt.title, rt.body, rt.locale
  from public.tenants t
  join public.venues v on v.tenant_id = t.id and v.is_active
  join public.reservation_terms_versions rt on rt.tenant_id = t.id and rt.venue_id = v.id
  where t.slug = p_slug and t.status in ('trial','active')
    and v.id = (
      select first_venue.id from public.venues first_venue
      where first_venue.tenant_id = t.id and first_venue.is_active
      order by first_venue.created_at, first_venue.id limit 1
    )
  order by rt.published_at desc, rt.version desc
  limit 1;
$$;
revoke all on function public.public_reservation_terms(text) from public, authenticated;
grant execute on function public.public_reservation_terms(text) to anon;

create or replace function public.create_public_reservation_with_details_v2(
  p_slug text, p_service_id uuid, p_starts_at timestamptz, p_party_size integer,
  p_guest_name text, p_guest_email text, p_guest_phone text, p_public_token_hash text,
  p_area_id uuid, p_notes text, p_privacy_accepted boolean,
  p_rate_key text, p_terms_version_id uuid default null
)
returns table (reservation_id uuid, starts_at timestamptz, ends_at timestamptz, venue_name text)
language plpgsql security definer set search_path = public as $$
declare
  v_tenant_id uuid;
  v_window timestamptz;
  v_attempts integer;
  v_reservation record;
begin
  select id into v_tenant_id from public.tenants where slug = p_slug and status in ('trial','active');
  if not found then raise exception 'public_restaurant_not_found' using errcode = 'P0002'; end if;
  if p_rate_key is null or p_rate_key !~ '^[a-f0-9]{64}$' then raise exception 'invalid_rate_key' using errcode = '22023'; end if;
  insert into public.public_reservation_rate_limits (tenant_id, rate_key) values (v_tenant_id, p_rate_key)
    on conflict (tenant_id, rate_key) do nothing;
  select window_started_at, attempt_count into v_window, v_attempts
    from public.public_reservation_rate_limits where tenant_id = v_tenant_id and rate_key = p_rate_key for update;
  if v_window < date_trunc('hour', now()) then
    v_window := date_trunc('hour', now()); v_attempts := 0;
  end if;
  if v_attempts >= 5 then raise exception 'public_reservation_rate_limited' using errcode = '22023'; end if;
  update public.public_reservation_rate_limits
    set window_started_at = v_window, attempt_count = v_attempts + 1, updated_at = now()
    where tenant_id = v_tenant_id and rate_key = p_rate_key;
  if p_terms_version_id is not null and not exists (
    select 1
    from public.reservation_terms_versions rt
    join public.venues v on v.id = rt.venue_id and v.tenant_id = v_tenant_id and v.is_active
    where rt.id = p_terms_version_id
      and rt.tenant_id = v_tenant_id
      and v.id = (
        select first_venue.id from public.venues first_venue
        where first_venue.tenant_id = v_tenant_id and first_venue.is_active
        order by first_venue.created_at, first_venue.id limit 1
      )
  ) then raise exception 'invalid_terms_version' using errcode = '22023'; end if;
  select * into v_reservation from public.create_public_reservation_with_details(
    p_slug, p_service_id, p_starts_at, p_party_size, p_guest_name, p_guest_email,
    p_guest_phone, p_public_token_hash, p_area_id, p_notes, p_privacy_accepted
  );
  update public.reservations set terms_version_id = p_terms_version_id where id = v_reservation.reservation_id;
  return query select v_reservation.reservation_id, v_reservation.starts_at, v_reservation.ends_at, v_reservation.venue_name;
end;
$$;
revoke execute on function public.create_public_reservation_with_details_v2(text,uuid,timestamptz,integer,text,text,text,text,uuid,text,boolean,text,uuid) from public, authenticated;
grant execute on function public.create_public_reservation_with_details_v2(text,uuid,timestamptz,integer,text,text,text,text,uuid,text,boolean,text,uuid) to anon;
