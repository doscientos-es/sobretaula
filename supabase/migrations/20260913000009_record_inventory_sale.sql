-- El TPV necesita consumir stock con una operación atómica y auditable.
-- La tabla mantiene escritura restringida; el TPV entra por esta función.
create or replace function public.record_inventory_sale(
  p_tenant_id uuid,
  p_venue_id uuid,
  p_reason text,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_line record;
  v_available numeric;
begin
  if not public.has_tenant_role(p_tenant_id, array['owner', 'manager', 'waiter']::public.tenant_role[])
     or not exists (
       select 1 from public.venues
       where id = p_venue_id and tenant_id = p_tenant_id and is_active
     ) then
    raise exception using errcode = '42501', message = 'inventory_sale_forbidden';
  end if;

  -- Serializa consumos del mismo local para que dos TPV no vendan el último stock a la vez.
  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_venue_id::text, 0));

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as line(ingredient_id text, quantity numeric)
    where line.ingredient_id is null or line.quantity is null or line.quantity <= 0
  ) then
    raise exception using errcode = '22023', message = 'inventory_sale_invalid_line';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as line(ingredient_id text, quantity numeric)
    left join public.ingredients i on i.id = line.ingredient_id::uuid and i.tenant_id = p_tenant_id
    where i.id is null
  ) then
    raise exception using errcode = '23503', message = 'inventory_sale_ingredient_not_found';
  end if;

  for v_line in
    select ingredient_id::uuid, sum(abs(quantity::numeric)) as quantity
    from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as line(ingredient_id text, quantity numeric)
    group by ingredient_id
  loop
    select coalesce(sum(quantity), 0) into v_available
    from public.inventory_movements
    where tenant_id = p_tenant_id and venue_id = p_venue_id and ingredient_id = v_line.ingredient_id;
    if v_available < v_line.quantity then
      raise exception using errcode = '22003', message = 'inventory_insufficient_stock';
    end if;
  end loop;

  insert into public.inventory_movements
    (tenant_id, venue_id, ingredient_id, kind, quantity, reason, created_by)
  select p_tenant_id, p_venue_id, ingredient_id::uuid, 'sale', -sum(abs(quantity::numeric)),
    p_reason, (select auth.uid())
  from jsonb_to_recordset(coalesce(p_lines, '[]'::jsonb)) as line(ingredient_id text, quantity numeric)
  group by ingredient_id;

  return jsonb_build_object('recorded', true);
end;
$$;

revoke execute on function public.record_inventory_sale(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.record_inventory_sale(uuid, uuid, text, jsonb) to authenticated;
