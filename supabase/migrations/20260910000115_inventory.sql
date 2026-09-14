-- Inventario por local. Las existencias se derivan de movimientos, nunca de un contador opaco.
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade, ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  kind text not null check (kind in ('purchase','sale','waste','adjustment')), quantity numeric(12,4) not null check (quantity <> 0),
  unit_cost_cents numeric(12,4) check (unit_cost_cents >= 0), reason text not null, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index inventory_movements_stock_idx on public.inventory_movements(tenant_id, venue_id, ingredient_id, created_at);
select public.apply_tenant_rls('inventory_movements', array['owner','manager']::public.tenant_role[]);
