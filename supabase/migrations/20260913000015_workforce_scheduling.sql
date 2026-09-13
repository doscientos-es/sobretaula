create table if not exists public.workforce_shifts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade, employee_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null, ends_at timestamptz not null, status text not null default 'draft' check (status in ('draft','published','confirmed','cancelled')),
  note text, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check (ends_at > starts_at)
);
create index if not exists workforce_shifts_window_idx on public.workforce_shifts(tenant_id, venue_id, starts_at);
create index if not exists workforce_shifts_employee_idx on public.workforce_shifts(tenant_id, employee_id, starts_at);
alter table public.workforce_shifts enable row level security;
alter table public.workforce_shifts force row level security;
create policy workforce_shifts_read on public.workforce_shifts for select using (public.is_tenant_member(tenant_id));
create policy workforce_shifts_write on public.workforce_shifts for all using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
