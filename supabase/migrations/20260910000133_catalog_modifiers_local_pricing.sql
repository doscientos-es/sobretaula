-- Extensiones aditivas del catálogo: modificadores y configuración por local/canal.
create table public.menu_modifier_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  name_i18n jsonb not null default '{}'::jsonb,
  selection_min integer not null default 0 check (selection_min >= 0),
  selection_max integer not null default 1 check (selection_max >= selection_min),
  position integer not null default 0 check (position >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_modifier_options (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_id uuid not null references public.menu_modifier_groups(id) on delete cascade,
  name_i18n jsonb not null default '{}'::jsonb,
  price_delta_cents integer not null default 0 check (price_delta_cents between -1000000 and 1000000),
  position integer not null default 0 check (position >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.menu_item_venue_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade,
  channel text not null check (channel in ('room','web','delivery','takeaway')),
  price_cents integer not null check (price_cents >= 0),
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, venue_id, menu_item_id, channel)
);

create table public.order_item_modifiers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  modifier_option_id uuid references public.menu_modifier_options(id) on delete set null,
  name_snapshot text not null,
  price_delta_cents integer not null,
  created_at timestamptz not null default now()
);

create index menu_modifier_groups_item_idx on public.menu_modifier_groups(tenant_id, menu_item_id, position);
create index menu_modifier_options_group_idx on public.menu_modifier_options(tenant_id, group_id, position);
create index menu_item_venue_prices_lookup_idx on public.menu_item_venue_prices(tenant_id, venue_id, menu_item_id, channel);
create index order_item_modifiers_item_idx on public.order_item_modifiers(tenant_id, order_item_id);

create trigger menu_modifier_groups_set_updated_at before update on public.menu_modifier_groups
  for each row execute function public.set_updated_at();
create trigger menu_modifier_options_set_updated_at before update on public.menu_modifier_options
  for each row execute function public.set_updated_at();
create trigger menu_item_venue_prices_set_updated_at before update on public.menu_item_venue_prices
  for each row execute function public.set_updated_at();

select public.apply_tenant_rls('menu_modifier_groups', array['owner','manager']::public.tenant_role[]);
select public.apply_tenant_rls('menu_modifier_options', array['owner','manager']::public.tenant_role[]);
select public.apply_venue_scoped_rls('menu_item_venue_prices', array['owner','manager']::public.tenant_role[]);
select public.apply_tenant_rls('order_item_modifiers', array['owner','manager','waiter']::public.tenant_role[]);
