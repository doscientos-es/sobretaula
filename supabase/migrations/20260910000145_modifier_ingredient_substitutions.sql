alter table public.menu_modifier_options
  add column ingredient_id uuid references public.ingredients(id) on delete restrict,
  add column replaces_ingredient_id uuid references public.ingredients(id) on delete restrict;

create index menu_modifier_options_ingredient_idx
  on public.menu_modifier_options(tenant_id, ingredient_id)
  where ingredient_id is not null;
