create table if not exists public.module_catalog (
  code text primary key,
  name text not null,
  description text not null,
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  is_addon boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_module_overrides (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_code text not null references public.module_catalog(code) on delete cascade,
  enabled boolean not null,
  note text,
  changed_by uuid references auth.users(id),
  changed_at timestamptz not null default now(),
  primary key (tenant_id, module_code)
);

create table if not exists public.tenant_module_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  module_code text not null references public.module_catalog(code) on delete restrict,
  status text not null default 'requested' check (status in ('requested','approved','rejected','cancelled')),
  message text,
  requested_by uuid references auth.users(id),
  resolved_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (tenant_id, module_code, status)
);

insert into public.module_catalog(code, name, description, monthly_price_cents, is_addon)
values
  ('core', 'Operativa', 'TPV, mesas, servicio, caja, carta y reservas básicas.', 0, false),
  ('inventory', 'Inventario y escandallos', 'Ingredientes, recetas, costes, compras y stock.', 0, false),
  ('reservations_pro', 'Reservas Pro', 'Lista de espera, depósitos, recordatorios y no-shows.', 0, false),
  ('loyalty', 'Clientes y fidelización', 'Clientes, puntos, campañas y tarjetas regalo.', 0, false),
  ('workforce', 'Equipo y turnos', 'Fichajes, turnos, ausencias y propinas.', 0, false),
  ('finance', 'Finanzas', 'Facturación, conciliación, gastos y exportación contable.', 0, false),
  ('online_ordering', 'Pedidos online', 'Pedidos para recoger o entregar y carta pública.', 0, false),
  ('analytics', 'Estadística avanzada', 'Rentabilidad por plato y trabajador, previsiones y comparativas.', 0, false),
  ('automation', 'Automatizaciones', 'Alertas, tareas y comunicaciones automáticas.', 0, false),
  ('multi_venue', 'Multi-local', 'Catálogo compartido, permisos y métricas consolidadas.', 0, false)
on conflict (code) do update set name = excluded.name, description = excluded.description,
  monthly_price_cents = excluded.monthly_price_cents, is_addon = excluded.is_addon;

alter table public.module_catalog enable row level security;
alter table public.tenant_module_overrides enable row level security;
alter table public.tenant_module_requests enable row level security;

create policy module_catalog_read on public.module_catalog for select to authenticated using (is_active);
create policy module_overrides_read on public.tenant_module_overrides for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','manager','accountant']::public.tenant_role[])
    or exists (select 1 from public.platform_members pm where pm.user_id = auth.uid()));
create policy module_overrides_platform_write on public.tenant_module_overrides for all to authenticated
  using (exists (select 1 from public.platform_members pm where pm.user_id = auth.uid() and pm.role in ('platform_owner','platform_support')))
  with check (exists (select 1 from public.platform_members pm where pm.user_id = auth.uid() and pm.role in ('platform_owner','platform_support')));
create policy module_requests_read on public.tenant_module_requests for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])
    or exists (select 1 from public.platform_members pm where pm.user_id = auth.uid()));
create policy module_requests_insert on public.tenant_module_requests for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy module_requests_platform_update on public.tenant_module_requests for update to authenticated
  using (exists (select 1 from public.platform_members pm where pm.user_id = auth.uid() and pm.role in ('platform_owner','platform_support')))
  with check (exists (select 1 from public.platform_members pm where pm.user_id = auth.uid() and pm.role in ('platform_owner','platform_support')));

grant select on public.module_catalog to authenticated;
grant select on public.tenant_module_overrides, public.tenant_module_requests to authenticated;
grant insert on public.tenant_module_requests to authenticated;
