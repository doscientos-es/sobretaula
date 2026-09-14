create or replace function public.create_public_online_order(p_tenant_id uuid, p_venue_id uuid, p_customer_name text, p_customer_phone text, p_channel text, p_items jsonb, p_requested_for timestamptz, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_total integer; v_invalid integer;
begin
  if p_customer_name is null or length(trim(p_customer_name)) not between 1 and 160 or p_channel not in ('pickup','delivery') or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'online_order_invalid_input' using errcode = '22023'; end if;
  select id into v_id from public.online_orders where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  if not exists (select 1 from public.venues where id = p_venue_id and tenant_id = p_tenant_id and is_active) then raise exception 'online_order_venue_not_found' using errcode = '22023'; end if;
  select count(*) into v_invalid from jsonb_array_elements(p_items) line where (line->>'menuItemId') is null or (line->>'quantity') !~ '^([1-9][0-9]?)$' or not exists (select 1 from public.menu_items i where i.id = (line->>'menuItemId')::uuid and i.tenant_id = p_tenant_id and i.is_active);
  if v_invalid > 0 then raise exception 'online_order_invalid_lines' using errcode = '22023'; end if;
  select coalesce(sum((line->>'quantity')::integer * coalesce((select cp.price_cents from public.menu_item_channel_prices cp where cp.menu_item_id = (line->>'menuItemId')::uuid and cp.tenant_id = p_tenant_id and cp.channel = case when p_channel = 'pickup' then 'takeaway' else 'delivery' end), i.price_cents)), 0) into v_total from jsonb_array_elements(p_items) line join public.menu_items i on i.id = (line->>'menuItemId')::uuid and i.tenant_id = p_tenant_id;
  if v_total <= 0 then raise exception 'online_order_invalid_lines' using errcode = '22023'; end if;
  insert into public.online_orders(tenant_id, venue_id, customer_name, customer_phone, channel, items, total_cents, requested_for, idempotency_key) values (p_tenant_id, p_venue_id, trim(p_customer_name), nullif(trim(p_customer_phone), ''), p_channel, p_items, v_total, p_requested_for, p_idempotency_key) returning id into v_id;
  return v_id;
end $$;
