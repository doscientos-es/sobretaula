create or replace function public.record_single_payment(
  p_tenant_id uuid, p_venue_id uuid, p_session_id uuid, p_amount_cents integer,
  p_method public.payment_method, p_tip_cents integer, p_operation_id uuid
)
returns table(payment_id uuid, balance_cents integer)
language plpgsql security definer set search_path = public
as $$
declare v_session record; v_batch_id uuid; v_existing uuid; v_gross integer; v_paid integer; v_balance integer;
begin
  if not public.has_tenant_role(p_tenant_id, array['owner', 'manager', 'waiter']::public.tenant_role[]) then raise exception 'payment_forbidden'; end if;
  if p_amount_cents is null or p_amount_cents <= 0 or coalesce(p_tip_cents, 0) < 0 then raise exception 'invalid_payment_amount'; end if;
  perform pg_advisory_xact_lock(hashtextextended('single-payment:' || p_tenant_id::text || ':' || p_operation_id::text, 0));
  select id into v_existing from public.payment_batches where tenant_id = p_tenant_id and operation_id = p_operation_id;
  if found then select id into payment_id from public.payments where batch_id = v_existing limit 1; balance_cents := null; return next; return; end if;
  select id, discount_cents, status into v_session from public.table_sessions where id = p_session_id and tenant_id = p_tenant_id and venue_id = p_venue_id for update;
  if not found or v_session.status <> 'open' then raise exception 'payment_session_not_open'; end if;
  select coalesce(sum(oi.quantity * (oi.unit_price_cents + coalesce(mods.modifier_cents, 0))), 0) into v_gross
    from public.orders o join public.order_items oi on oi.order_id = o.id
    left join lateral (select coalesce(sum(price_delta_cents), 0) modifier_cents from public.order_item_modifiers m where m.order_item_id = oi.id) mods on true
    where o.session_id = p_session_id and oi.status <> 'cancelled';
  select coalesce(sum(amount_cents), 0) into v_paid from public.payments where session_id = p_session_id;
  v_balance := greatest(0, v_gross - coalesce(v_session.discount_cents, 0) - v_paid);
  if p_amount_cents > v_balance then raise exception 'payment_exceeds_balance'; end if;
  insert into public.payment_batches (tenant_id, venue_id, session_id, operation_id, total_cents, created_by) values (p_tenant_id, p_venue_id, p_session_id, p_operation_id, p_amount_cents, auth.uid()) returning id into v_batch_id;
  insert into public.payments (tenant_id, session_id, method, amount_cents, tip_cents, created_by, batch_id) values (p_tenant_id, p_session_id, p_method, p_amount_cents, coalesce(p_tip_cents, 0), auth.uid(), v_batch_id) returning id into payment_id;
  balance_cents := v_balance - p_amount_cents; return next;
end; $$;
revoke execute on function public.record_single_payment(uuid, uuid, uuid, integer, public.payment_method, integer, uuid) from public, anon;
grant execute on function public.record_single_payment(uuid, uuid, uuid, integer, public.payment_method, integer, uuid) to authenticated;
