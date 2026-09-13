-- Importación atómica de carta: una carga no puede dejar filas parciales.
create or replace function public.import_menu_catalog(
  p_tenant_id uuid,
  p_rows jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row jsonb;
  v_category_id uuid;
  v_item_id uuid;
  v_group_id uuid;
  v_categories integer := 0;
  v_items integer := 0;
  v_category text;
  v_category_key text;
  v_group text;
  v_modifier text;
begin
  if not public.has_tenant_role(p_tenant_id, array['owner','manager']::public.tenant_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'menu_import_empty' using errcode = '22023';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_category := nullif(trim(v_row->>'category'), '');
    if v_category is null or nullif(trim(v_row->>'nameEs'), '') is null then
      raise exception 'menu_import_invalid_row' using errcode = '22023';
    end if;
    v_category_key := lower(v_category);
    select id into v_category_id
      from public.menu_categories
      where tenant_id = p_tenant_id and lower(trim(name_i18n->>'es')) = v_category_key
      limit 1;
    if v_category_id is null then
      insert into public.menu_categories (tenant_id, name_i18n, position)
      values (p_tenant_id, jsonb_build_object('es', v_category),
              (select count(*)::integer from public.menu_categories where tenant_id = p_tenant_id))
      returning id into v_category_id;
      v_categories := v_categories + 1;
    end if;
    insert into public.menu_items (
      tenant_id, category_id, sku, name_i18n, description_i18n, price_cents, vat_rate_bps
    ) values (
      p_tenant_id, v_category_id, nullif(trim(v_row->>'sku'), ''),
      jsonb_build_object('es', v_row->>'nameEs'),
      case when nullif(v_row->>'descriptionEs', '') is null then '{}'::jsonb
           else jsonb_build_object('es', v_row->>'descriptionEs') end,
      (v_row->>'priceCents')::integer, (v_row->>'vatRateBps')::integer
    ) returning id into v_item_id;
    v_items := v_items + 1;
    v_group := nullif(trim(v_row->>'modifierGroup'), '');
    v_modifier := nullif(trim(v_row->>'modifierName'), '');
    if v_group is not null and v_modifier is not null then
      insert into public.menu_modifier_groups (tenant_id, menu_item_id, name_i18n, position, selection_min, selection_max)
      values (p_tenant_id, v_item_id, jsonb_build_object('es', v_group), 0, 0, 1)
      returning id into v_group_id;
      insert into public.menu_modifier_options (tenant_id, group_id, name_i18n, position, price_delta_cents)
      values (p_tenant_id, v_group_id, jsonb_build_object('es', v_modifier), 0,
              coalesce((v_row->>'modifierPriceDeltaCents')::integer, 0));
    elsif v_group is not null or v_modifier is not null then
      raise exception 'modifier_group_and_name_required' using errcode = '22023';
    end if;
  end loop;
  return jsonb_build_object('categoriesCreated', v_categories, 'itemsCreated', v_items);
exception
  when unique_violation then
    raise exception 'menu_import_duplicate_sku' using errcode = '23505';
end;
$$;

revoke all on function public.import_menu_catalog(uuid, jsonb) from public;
grant execute on function public.import_menu_catalog(uuid, jsonb) to authenticated;


