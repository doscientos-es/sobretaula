-- Reglas específicas por área y bloqueos operativos publicados.

create table public.service_area_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  starts_at_time time not null,
  ends_at_time time not null,
  duration_minutes integer check (duration_minutes is null or duration_minutes between 15 and 480),
  max_party_size integer check (max_party_size is null or max_party_size > 0),
  max_covers_per_slot integer check (max_covers_per_slot is null or max_covers_per_slot > 0),
  is_active boolean not null default true,
  is_online_bookable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (service_id, area_id),
  check (ends_at_time > starts_at_time)
);

create table public.scheduling_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  area_id uuid references public.areas (id) on delete cascade,
  period tstzrange not null,
  block_type text not null check (block_type in ('closure', 'vacation', 'private_event', 'maintenance', 'last_minute')),
  title text not null check (length(btrim(title)) between 1 and 120),
  internal_note text,
  visible_online boolean not null default true,
  affects_staff boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index service_area_rules_lookup_idx on public.service_area_rules (tenant_id, service_id, area_id) where is_active;
create index scheduling_blocks_period_idx on public.scheduling_blocks using gist (tenant_id, venue_id, period);
alter table public.service_area_rules enable row level security;
alter table public.service_area_rules force row level security;
alter table public.scheduling_blocks enable row level security;
alter table public.scheduling_blocks force row level security;
create policy service_area_rules_read on public.service_area_rules for select using (public.is_tenant_member(tenant_id));
create policy service_area_rules_write on public.service_area_rules for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy scheduling_blocks_read on public.scheduling_blocks for select using (public.is_tenant_member(tenant_id));
create policy scheduling_blocks_write on public.scheduling_blocks for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create trigger service_area_rules_set_updated_at before update on public.service_area_rules for each row execute function public.set_updated_at();
create trigger scheduling_blocks_set_updated_at before update on public.scheduling_blocks for each row execute function public.set_updated_at();
