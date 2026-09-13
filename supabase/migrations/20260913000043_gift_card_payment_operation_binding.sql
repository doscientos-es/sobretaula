alter table public.gift_card_transactions
  add column if not exists operation_id uuid,
  add column if not exists payment_id uuid;

create unique index if not exists gift_card_transactions_operation_idx
  on public.gift_card_transactions (tenant_id, operation_id)
  where operation_id is not null;

create or replace function public.record_gift_card_payment(
  p_tenant_id uuid,
  p_venue_id uuid,
  p_session_id uuid,
  p_amount_cents integer,
  p_code text,
  p_operation_id uuid
) returns table(payment_id uuid, balance_cents integer)
language plpgsql security definer set search_path=public as $$
declare
  v_payment record;
  v_card gift_cards;
  v_existing gift_card_transactions;
begin
  if not public.has_tenant_role(p_tenant_id, array['owner','manager','waiter']::public.tenant_role[]) then
    raise exception 'forbidden';
  end if;
  if p_amount_cents <= 0 then raise exception 'invalid_gift_card_amount'; end if;

  select * into v_existing
    from gift_card_transactions
   where tenant_id = p_tenant_id and operation_id = p_operation_id
   for update;
  if found then
    select gc.balance_cents into balance_cents from gift_cards as gc where gc.id = v_existing.gift_card_id;
    return query select v_existing.payment_id, balance_cents;
    return;
  end if;

  select * into v_payment from public.record_single_payment(
    p_tenant_id, p_venue_id, p_session_id, p_amount_cents,
    'voucher'::public.payment_method, 0, p_operation_id
  );

  if v_payment.balance_cents is null then
    select * into v_existing
      from gift_card_transactions
     where tenant_id = p_tenant_id and operation_id = p_operation_id
     for update;
    if not found then raise exception 'gift_card_operation_binding_missing'; end if;
    select gc.balance_cents into balance_cents from gift_cards as gc where gc.id = v_existing.gift_card_id;
    return query select v_existing.payment_id, balance_cents;
    return;
  end if;

  select * into v_card from gift_cards
   where tenant_id = p_tenant_id
     and code = upper(regexp_replace(trim(p_code), '\s+', '', 'g'))
     and status = 'active'
   for update;
  if not found or v_card.balance_cents < p_amount_cents then
    raise exception 'gift_card_insufficient_balance';
  end if;

  update gift_cards set balance_cents = balance_cents - p_amount_cents,
    status = case when balance_cents - p_amount_cents = 0 then 'exhausted' else 'active' end,
    updated_at = now() where id = v_card.id;
  insert into gift_card_transactions(tenant_id, gift_card_id, amount_cents, reason, created_by, operation_id, payment_id)
    values (p_tenant_id, v_card.id, -p_amount_cents, 'Pago de cuenta en TPV', auth.uid(), p_operation_id, v_payment.payment_id);
  payment_id := v_payment.payment_id;
  balance_cents := v_card.balance_cents - p_amount_cents;
  return next;
end; $$;

revoke execute on function public.record_gift_card_payment(uuid, uuid, uuid, integer, text, uuid) from public, anon;
grant execute on function public.record_gift_card_payment(uuid, uuid, uuid, integer, text, uuid) to authenticated;
