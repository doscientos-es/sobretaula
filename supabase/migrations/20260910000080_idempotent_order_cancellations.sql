-- Comandas reintentables y anulaciones conservadas como evidencia operativa.
alter table public.orders
  add column if not exists operation_id uuid;

create unique index if not exists orders_operation_id_idx
  on public.orders (operation_id)
  where operation_id is not null;

create table public.order_item_cancellations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  order_item_id uuid not null unique references public.order_items(id) on delete restrict,
  reason text not null check (char_length(reason) between 2 and 200),
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz not null default now()
);

create index if not exists order_item_cancellations_tenant_idx
  on public.order_item_cancellations (tenant_id, venue_id, cancelled_at desc);

select public.apply_tenant_rls(
  'order_item_cancellations',
  array['owner', 'manager', 'waiter']::public.tenant_role[]
);