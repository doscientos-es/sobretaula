-- Parámetros laborales explícitos por persona y calendario aplicable a cada local.
-- Los valores son configurables por convenio; no habilitan liquidación automática.

create table public.timekeeping_employee_terms (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null default current_date,
  employment_type text not null check (employment_type in ('full_time', 'part_time')),
  daily_target_minutes integer not null check (daily_target_minutes between 1 and 960),
  minimum_break_minutes integer not null default 15 check (minimum_break_minutes between 0 and 180),
  minimum_daily_rest_minutes integer not null default 720 check (minimum_daily_rest_minutes between 0 and 1440),
  night_starts_at time not null default time '22:00',
  night_ends_at time not null default time '06:00',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, employee_id, effective_from)
);

create index timekeeping_employee_terms_current_idx
  on public.timekeeping_employee_terms (tenant_id, employee_id, effective_from desc);

create table public.timekeeping_holidays (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  holiday_date date not null,
  label text not null check (length(btrim(label)) between 1 and 120),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, venue_id, holiday_date)
);

alter table public.timekeeping_employee_terms enable row level security;
alter table public.timekeeping_employee_terms force row level security;
alter table public.timekeeping_holidays enable row level security;
alter table public.timekeeping_holidays force row level security;

create policy timekeeping_employee_terms_read on public.timekeeping_employee_terms
  for select to authenticated using (
    employee_id = auth.uid()
    or public.has_operational_tenant_role(
      tenant_id, array['owner', 'manager']::public.tenant_role[]
    )
  );
create policy timekeeping_employee_terms_write on public.timekeeping_employee_terms
  for all to authenticated using (
    public.has_operational_tenant_role(
      tenant_id, array['owner', 'manager']::public.tenant_role[]
    )
  ) with check (
    public.has_operational_tenant_role(
      tenant_id, array['owner', 'manager']::public.tenant_role[]
    )
  );

create policy timekeeping_holidays_read on public.timekeeping_holidays
  for select to authenticated using (
    public.is_operational_member_of(tenant_id) and public.has_venue_access(venue_id)
  );
create policy timekeeping_holidays_write on public.timekeeping_holidays
  for all to authenticated using (
    public.has_operational_tenant_role(
      tenant_id, array['owner', 'manager']::public.tenant_role[]
    ) and public.has_venue_access(venue_id)
  ) with check (
    public.has_operational_tenant_role(
      tenant_id, array['owner', 'manager']::public.tenant_role[]
    ) and public.has_venue_access(venue_id)
  );