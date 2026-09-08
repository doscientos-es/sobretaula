-- Sala: áreas, versiones de plano, geometría y mesas.
-- La identidad de la mesa vive en `tables`; su posición, en `table_placements`.

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  assignment_priority integer not null default 100,
  is_online_bookable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, venue_id, name)
);

create table public.floor_plan_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  name text not null,
  width_cm integer not null check (width_cm > 0),
  height_cm integer not null check (height_cm > 0),
  active_from timestamptz not null default now(),
  active_to timestamptz,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  check (active_to is null or active_to > active_from)
);

create index floor_plan_versions_area_idx on public.floor_plan_versions (area_id, active_from desc);

create table public.plan_elements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  floor_plan_version_id uuid not null references public.floor_plan_versions (id) on delete cascade,
  kind public.plan_element_kind not null,
  label text,
  x_cm integer not null,
  y_cm integer not null,
  width_cm integer not null check (width_cm > 0),
  height_cm integer not null check (height_cm > 0),
  rotation_deg integer not null default 0 check (rotation_deg between 0 and 359),
  created_at timestamptz not null default now()
);

create index plan_elements_version_idx on public.plan_elements (floor_plan_version_id);

create table public.tables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete restrict,
  code text not null check (length(btrim(code)) > 0),
  shape public.table_shape not null default 'square',
  min_seats integer not null default 1 check (min_seats > 0),
  max_seats integer not null check (max_seats > 0),
  is_bookable boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, venue_id, code),
  check (max_seats >= min_seats)
);

create table public.table_placements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  floor_plan_version_id uuid not null references public.floor_plan_versions (id) on delete cascade,
  table_id uuid not null references public.tables (id) on delete cascade,
  x_cm integer not null,
  y_cm integer not null,
  width_cm integer not null check (width_cm > 0),
  height_cm integer not null check (height_cm > 0),
  rotation_deg integer not null default 0 check (rotation_deg between 0 and 359),
  unique (floor_plan_version_id, table_id)
);

create table public.table_group_presets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  name text not null,
  table_ids uuid[] not null check (array_length(table_ids, 1) >= 2),
  max_seats integer not null check (max_seats > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, area_id, name)
);

create trigger areas_set_updated_at before update on public.areas
  for each row execute function public.set_updated_at();
create trigger tables_set_updated_at before update on public.tables
  for each row execute function public.set_updated_at();

select public.apply_tenant_rls('areas', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('floor_plan_versions', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('plan_elements', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('tables', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('table_placements', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('table_group_presets', array['owner', 'manager']::public.tenant_role[]);
