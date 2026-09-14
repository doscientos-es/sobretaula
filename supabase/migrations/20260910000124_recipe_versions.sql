create table public.recipe_versions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  menu_item_id uuid not null references public.menu_items(id) on delete cascade, version integer not null,
  lines jsonb not null default '[]'::jsonb, created_by uuid references auth.users(id), created_at timestamptz not null default now(),
  unique(tenant_id, menu_item_id, version)
);
select public.apply_tenant_rls('recipe_versions', array['owner','manager']::public.tenant_role[]);
