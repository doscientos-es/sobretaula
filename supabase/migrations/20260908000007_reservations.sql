-- Reservas: turnos, reglas, comensales y asignación de mesas sin solapamiento.

create table public.services (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at_time time not null,
  ends_at_time time not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, venue_id, name, weekday),
  check (ends_at_time > starts_at_time)
);

create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  slot_minutes smallint not null default 15 check (slot_minutes > 0),
  max_covers_per_slot integer check (max_covers_per_slot is null or max_covers_per_slot > 0),
  max_reservations_per_slot integer check (max_reservations_per_slot is null or max_reservations_per_slot > 0),
  duration_minutes_by_party jsonb not null default '{}'::jsonb,
  min_lead_minutes integer not null default 0 check (min_lead_minutes >= 0),
  max_lead_days integer not null default 90 check (max_lead_days > 0),
  updated_at timestamptz not null default now(),
  unique (service_id)
);

create table public.closures (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  area_id uuid references public.areas (id) on delete cascade,
  reason text,
  period tstzrange not null,
  created_at timestamptz not null default now()
);

create index closures_period_idx on public.closures using gist (period);

create table public.guests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) > 0),
  phone text,
  email text,
  locale public.app_locale not null default 'es',
  notes text,
  allergies text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index guests_tenant_phone_idx on public.guests (tenant_id, phone) where phone is not null;
create unique index guests_tenant_email_idx on public.guests (tenant_id, email) where email is not null;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  area_id uuid references public.areas (id) on delete set null,
  guest_id uuid references public.guests (id) on delete set null,
  party_size integer not null check (party_size > 0),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.reservation_status not null default 'pending',
  source public.reservation_source not null default 'staff',
  notes text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index reservations_window_idx on public.reservations (tenant_id, venue_id, starts_at);

create table public.reservation_tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  table_id uuid not null references public.tables (id) on delete restrict,
  status public.reservation_status not null,
  period tstzrange not null,
  unique (reservation_id, table_id),
  constraint reservation_tables_no_overlap exclude using gist (
    tenant_id with =,
    table_id with =,
    period with &&
  ) where (status in ('confirmed', 'seated'))
);

create table public.holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  table_id uuid references public.tables (id) on delete cascade,
  party_size integer not null check (party_size > 0),
  period tstzrange not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index holds_expiry_idx on public.holds (expires_at);

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  guest_id uuid references public.guests (id) on delete set null,
  party_size integer not null check (party_size > 0),
  requested_for timestamptz not null,
  estimated_wait_minutes integer check (estimated_wait_minutes is null or estimated_wait_minutes >= 0),
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

-- El periodo de la asignación deriva siempre de la reserva; nunca del cliente.
create or replace function public.sync_reservation_tables()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.reservation_tables rt
  set period = tstzrange(new.starts_at, new.ends_at, '[)'),
      status = new.status
  where rt.reservation_id = new.id;
  return new;
end;
$$;

create trigger reservations_sync_tables after update of starts_at, ends_at, status
  on public.reservations
  for each row execute function public.sync_reservation_tables();

create trigger services_set_updated_at before update on public.services
  for each row execute function public.set_updated_at();
create trigger availability_rules_set_updated_at before update on public.availability_rules
  for each row execute function public.set_updated_at();
create trigger guests_set_updated_at before update on public.guests
  for each row execute function public.set_updated_at();
create trigger reservations_set_updated_at before update on public.reservations
  for each row execute function public.set_updated_at();
