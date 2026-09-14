create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade, supplier_id uuid not null references public.suppliers(id),
  status text not null default 'draft' check (status in ('draft','approved','sent','received','cancelled')),
  notes text not null default '', approved_by uuid references auth.users(id), approved_at timestamptz,
  created_by uuid references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.purchase_order_lines (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id), quantity numeric not null check (quantity > 0), unit_cost_cents integer not null check (unit_cost_cents >= 0),
  unique (purchase_order_id, ingredient_id)
);
alter table public.purchase_orders enable row level security;
alter table public.purchase_orders force row level security;
alter table public.purchase_order_lines enable row level security;
alter table public.purchase_order_lines force row level security;
create policy purchase_orders_tenant_access on public.purchase_orders for all using (public.has_tenant_role(tenant_id, array['owner','manager','accountant']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy purchase_order_lines_tenant_access on public.purchase_order_lines for all using (public.has_tenant_role(tenant_id, array['owner','manager','accountant']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create index if not exists purchase_orders_lookup on public.purchase_orders(tenant_id, venue_id, created_at desc);
