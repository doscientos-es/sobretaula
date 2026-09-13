create or replace function public.inventory_stock_by_venue(p_tenant_id uuid, p_venue_id uuid)
returns table(ingredient_id uuid, quantity numeric)
language sql security definer set search_path = public
as $$
  select m.ingredient_id, coalesce(sum(m.quantity), 0)::numeric
  from public.inventory_movements m
  where m.tenant_id = p_tenant_id
    and m.venue_id = p_venue_id
    and public.has_operational_tenant_role(p_tenant_id, array['owner','manager']::public.tenant_role[])
    and public.has_venue_access(p_venue_id)
  group by m.ingredient_id;
$$;
revoke execute on function public.inventory_stock_by_venue(uuid, uuid) from public, anon;
grant execute on function public.inventory_stock_by_venue(uuid, uuid) to authenticated;
