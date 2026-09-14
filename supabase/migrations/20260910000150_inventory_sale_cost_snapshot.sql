-- Congela el coste vigente al registrar el consumo para que el histórico
-- económico no cambie cuando se actualice el precio del ingrediente.
create or replace function public.record_inventory_sale(
  p_tenant_id uuid, p_venue_id uuid, p_reason text, p_lines jsonb
)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_line record;
  v_available numeric;
begin
  if not public.has_tenant_role(p_tenant_id, array['owner','manager','waiter']::public.tenant_role[])
     or not exists (select 1 from public.venues where id = p_venue_id and tenant_id = p_tenant_id and is_active)
  then raise exception using errcode = '42501', message = 'inventory_sale_forbidden'; end if;
  if exists (select 1 from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as line(ingredient_id text, quantity numeric)
    where line.ingredient_id is null or line.quantity is null or line.quantity <= 0)
  then raise exception using errcode = '22023', message = 'inventory_sale_invalid_line'; end if;
  if exists (select 1 from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as line(ingredient_id text, quantity numeric)
    left join public.ingredients i on i.id = line.ingredient_id::uuid and i.tenant_id = p_tenant_id
    where i.id is null)
  then raise exception using errcode = '23503', message = 'inventory_sale_ingredient_not_found'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_venue_id::text, 0));
  for v_line in
    select i.id as ingredient_id, i.cost_cents_per_unit, sum(abs(line.quantity::numeric)) as quantity
    from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as line(ingredient_id text, quantity numeric)
    join public.ingredients i on i.id = line.ingredient_id::uuid and i.tenant_id = p_tenant_id
    group by i.id, i.cost_cents_per_unit
  loop
    select coalesce(sum(quantity), 0) into v_available from public.inventory_movements
      where tenant_id = p_tenant_id and venue_id = p_venue_id and ingredient_id = v_line.ingredient_id;
    if v_available < v_line.quantity then raise exception using errcode = '22003', message = 'inventory_insufficient_stock'; end if;
    insert into public.inventory_movements (tenant_id, venue_id, ingredient_id, kind, quantity, unit_cost_cents, reason, created_by)
      values (p_tenant_id, p_venue_id, v_line.ingredient_id, 'sale', -v_line.quantity,
        v_line.cost_cents_per_unit, p_reason, auth.uid());
  end loop;
  return jsonb_build_object('recorded', true);
end;
$$;
revoke execute on function public.record_inventory_sale(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.record_inventory_sale(uuid, uuid, text, jsonb) to authenticated;
