create table public.service_handover_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  summary jsonb not null,
  created_at timestamptz not null default now()
);

create index service_handover_snapshots_lookup_idx
  on public.service_handover_snapshots (tenant_id, venue_id, created_at desc);

alter table public.service_handover_snapshots enable row level security;
alter table public.service_handover_snapshots force row level security;
create policy service_handover_snapshots_read on public.service_handover_snapshots
  for select using (public.is_tenant_member(tenant_id));
create policy service_handover_snapshots_write on public.service_handover_snapshots
  for insert with check (public.has_tenant_role(tenant_id, array['owner', 'manager', 'host']::public.tenant_role[]));
