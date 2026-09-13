alter table public.online_orders add column if not exists idempotency_key text;
create unique index if not exists online_orders_idempotency_idx on public.online_orders(tenant_id, idempotency_key) where idempotency_key is not null;
create or replace function public.create_public_online_order(p_tenant_id uuid, p_venue_id uuid, p_customer_name text, p_customer_phone text, p_channel text, p_items jsonb, p_requested_for timestamptz, p_idempotency_key text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_total integer; v_invalid integer; begin
  if p_customer_name is null or length(trim(p_customer_name)) not between 1 and 160 or p_channel not in ('pickup','delivery') or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'online_order_invalid_input' using errcode = '22023'; end if;
  select id into v_id from public.online_orders where tenant_id = p_tenant_id and idempotency_key = p_idempotency_key;
  if v_id is not null then return v_id; end if;
  if not exists (select 1 from public.venues where id = p_venue_id and tenant_id = p_tenant_id and is_active) then raise exception 'online_order_venue_not_found' using errcode = '22023'; end if;
  select count(*) into v_invalid from jsonb_array_elements(p_items) line where length(trim(coalesce(line->>'name', ''))) = 0 or (line->>'quantity') !~ '^([1-9][0-9]?)$' or (line->>'unitPriceCents') !~ '^[0-9]+$';
  if v_invalid > 0 then raise exception 'online_order_invalid_lines' using errcode = '22023'; end if;
  select coalesce(sum((line->>'quantity')::integer * (line->>'unitPriceCents')::integer), 0) into v_total from jsonb_array_elements(p_items) line where (line->>'quantity')::integer between 1 and 99 and (line->>'unitPriceCents')::integer >= 0 and length(trim(line->>'name')) > 0;
  if v_total <= 0 then raise exception 'online_order_invalid_lines' using errcode = '22023'; end if;
  insert into public.online_orders(tenant_id, venue_id, customer_name, customer_phone, channel, items, total_cents, requested_for, idempotency_key) values (p_tenant_id, p_venue_id, trim(p_customer_name), nullif(trim(p_customer_phone), ''), p_channel, p_items, v_total, p_requested_for, p_idempotency_key) returning id into v_id;
  return v_id;
end $$;
revoke execute on function public.create_public_online_order(uuid, uuid, text, text, text, jsonb, timestamptz, text) from public, authenticated;
grant execute on function public.create_public_online_order(uuid, uuid, text, text, text, jsonb, timestamptz, text) to anon;
