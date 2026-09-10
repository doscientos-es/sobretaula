-- Ficha maestra de ingredientes y escandallos versionables por producto.
create table public.ingredients (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null, unit text not null check (unit in ('g','kg','ml','l','unit')), cost_cents_per_unit numeric(12,4) not null check (cost_cents_per_unit >= 0),
  allergens text[] not null default '{}', is_vegan boolean not null default false, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade, ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(12,4) not null check (quantity > 0), waste_percent numeric(5,2) not null default 0 check (waste_percent between 0 and 100),
  unique(menu_item_id, ingredient_id)
);
create index recipe_ingredients_menu_item_idx on public.recipe_ingredients(tenant_id, menu_item_id);
create trigger ingredients_set_updated_at before update on public.ingredients for each row execute function public.set_updated_at();
select public.apply_tenant_rls('ingredients', array['owner','manager']::public.tenant_role[]);
select public.apply_tenant_rls('recipe_ingredients', array['owner','manager']::public.tenant_role[]);
