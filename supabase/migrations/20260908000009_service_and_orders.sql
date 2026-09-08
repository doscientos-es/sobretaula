-- Servicio y cuenta: sesiones de mesa, carta, comandas y cobros.
-- Importes siempre en céntimos (entero). Nunca coma flotante.

create table public.table_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  reservation_id uuid references public.reservations (id) on delete set null,
  table_ids uuid[] not null check (array_length(table_ids, 1) >= 1),
  covers integer not null check (covers > 0),
  status public.session_status not null default 'open',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opened_by uuid references auth.users (id),
  check (closed_at is null or closed_at >= opened_at)
);

create index table_sessions_open_idx on public.table_sessions (tenant_id, venue_id) where status = 'open';

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name_i18n jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  category_id uuid not null references public.menu_categories (id) on delete restrict,
  sku text,
  name_i18n jsonb not null default '{}'::jsonb,
  description_i18n jsonb not null default '{}'::jsonb,
  price_cents integer not null check (price_cents >= 0),
  vat_rate_bps integer not null check (vat_rate_bps between 0 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, sku)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  session_id uuid not null references public.table_sessions (id) on delete cascade,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  name_snapshot text not null,
  quantity integer not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  vat_rate_bps integer not null check (vat_rate_bps between 0 and 10000),
  notes text,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  session_id uuid not null references public.table_sessions (id) on delete cascade,
  method public.payment_method not null,
  amount_cents integer not null check (amount_cents > 0),
  tip_cents integer not null default 0 check (tip_cents >= 0),
  paid_at timestamptz not null default now(),
  created_by uuid references auth.users (id)
);

create index payments_session_idx on public.payments (session_id);

create trigger menu_categories_set_updated_at before update on public.menu_categories
  for each row execute function public.set_updated_at();
create trigger menu_items_set_updated_at before update on public.menu_items
  for each row execute function public.set_updated_at();

select public.apply_tenant_rls('table_sessions', array['owner', 'manager', 'host', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('menu_categories', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('menu_items', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('orders', array['owner', 'manager', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('order_items', array['owner', 'manager', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('payments', array['owner', 'manager', 'waiter']::public.tenant_role[]);
