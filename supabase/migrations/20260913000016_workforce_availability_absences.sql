create table if not exists public.workforce_availability (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade, weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null, ends_at time not null, available boolean not null default true, created_at timestamptz not null default now(),
  unique (tenant_id, employee_id, weekday, starts_at), check (ends_at > starts_at)
);
create table if not exists public.workforce_absences (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade, starts_at date not null, ends_at date not null,
  reason text not null check (length(trim(reason)) > 0), status text not null default 'requested' check (status in ('requested','approved','rejected')), created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), check (ends_at >= starts_at)
);
create index if not exists workforce_availability_employee_idx on public.workforce_availability(tenant_id, employee_id, weekday);
create index if not exists workforce_absences_window_idx on public.workforce_absences(tenant_id, employee_id, starts_at, ends_at);
alter table public.workforce_availability enable row level security;
alter table public.workforce_availability force row level security;
alter table public.workforce_absences enable row level security;
alter table public.workforce_absences force row level security;
create policy workforce_availability_read on public.workforce_availability for select using (public.is_tenant_member(tenant_id));
create policy workforce_availability_write on public.workforce_availability for all using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy workforce_absences_read on public.workforce_absences for select using (public.is_tenant_member(tenant_id));
create policy workforce_absences_write on public.workforce_absences for all using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
