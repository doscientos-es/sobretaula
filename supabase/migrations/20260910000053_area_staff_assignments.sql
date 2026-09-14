create table public.area_staff_assignments (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  area_id uuid not null references public.areas (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (area_id, user_id)
);

create index area_staff_assignments_tenant_idx
  on public.area_staff_assignments (tenant_id, area_id);

alter table public.area_staff_assignments enable row level security;
alter table public.area_staff_assignments force row level security;
create policy area_staff_assignments_read on public.area_staff_assignments
  for select using (public.is_tenant_member(tenant_id));
create policy area_staff_assignments_write on public.area_staff_assignments
  for all using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
