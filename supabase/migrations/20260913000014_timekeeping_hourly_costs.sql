-- Coste horario configurable para análisis de rentabilidad; no es nómina.
create table public.timekeeping_employee_rates (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade,
  effective_from date not null default current_date,
  hourly_cost_cents integer not null check (hourly_cost_cents >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, employee_id, effective_from)
);
alter table public.timekeeping_employee_rates enable row level security;
alter table public.timekeeping_employee_rates force row level security;
create policy timekeeping_employee_rates_read on public.timekeeping_employee_rates for select to authenticated
  using (public.has_operational_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy timekeeping_employee_rates_write on public.timekeeping_employee_rates for all to authenticated
  using (public.has_operational_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]))
  with check (public.has_operational_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create index timekeeping_employee_rates_current_idx on public.timekeeping_employee_rates(tenant_id, employee_id, effective_from desc);
