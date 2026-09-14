create or replace function public.public_menu_by_slug_v2(p_slug text, p_channel text default 'web')
returns table(category_id uuid, category_name_i18n jsonb, category_position integer, item_id uuid, item_name_i18n jsonb, item_description_i18n jsonb, price_cents integer, vat_rate_bps integer, item_is_active boolean, allergens text[], allergen_reasons jsonb, is_vegan boolean)
language sql security definer set search_path = public
as $$
  select c.id, c.name_i18n, c.position, i.id, i.name_i18n, i.description_i18n, coalesce((select price_cents from menu_item_channel_prices cp where cp.menu_item_id = i.id and cp.tenant_id = t.id and cp.channel = p_channel), i.price_cents), i.vat_rate_bps, i.is_active,
    coalesce((select array_agg(distinct a order by a) from recipe_ingredients ri join ingredients ing on ing.id = ri.ingredient_id cross join unnest(ing.allergens) a where ri.menu_item_id = i.id), '{}'),
    coalesce((select jsonb_object_agg(a, names) from (select a, jsonb_agg(distinct ing.name order by ing.name) names from recipe_ingredients ri join ingredients ing on ing.id = ri.ingredient_id cross join unnest(ing.allergens) a where ri.menu_item_id = i.id group by a) reasons), '{}'::jsonb),
    coalesce((select bool_and(ing.is_vegan) from recipe_ingredients ri join ingredients ing on ing.id = ri.ingredient_id where ri.menu_item_id = i.id), true)
  from tenants t join menu_categories c on c.tenant_id = t.id join menu_items i on i.category_id = c.id where t.slug = p_slug and c.is_active and i.is_active order by c.position, i.name_i18n->>'es';
$$;
revoke all on function public.public_menu_by_slug_v2(text, text) from public;
grant execute on function public.public_menu_by_slug_v2(text, text) to anon, authenticated;
