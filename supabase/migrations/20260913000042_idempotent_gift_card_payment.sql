create or replace function public.record_gift_card_payment(
  p_tenant_id uuid, p_venue_id uuid, p_session_id uuid, p_amount_cents integer,
  p_code text, p_operation_id uuid
)
returns table(payment_id uuid, balance_cents integer)
language plpgsql security definer set search_path=public as $$
declare
  v_card public.gift_cards;
  v_payment record;
begin
  if not public.has_tenant_role(p_tenant_id, array['owner','manager','waiter']::public.tenant_role[]) then
    raise exception 'payment_forbidden';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_payment_amount';
  end if;
  select * into v_payment from public.record_single_payment(
    p_tenant_id, p_venue_id, p_session_id, p_amount_cents,
    'voucher'::public.payment_method, 0, p_operation_id
  );
  if v_payment.balance_cents is null then
    return query select v_payment.payment_id, null::integer;
    return;
  end if;
  select * into v_card from public.gift_cards
    where tenant_id=p_tenant_id
      and code=upper(regexp_replace(trim(p_code), '\s+', '', 'g'))
      and status='active'
    for update;
  if not found or v_card.balance_cents < p_amount_cents then
    raise exception 'gift_card_insufficient_balance';
  end if;
  update public.gift_cards
    set balance_cents=balance_cents-p_amount_cents,
        status=case when balance_cents-p_amount_cents=0 then 'exhausted' else 'active' end,
        updated_at=now()
    where id=v_card.id;
  insert into public.gift_card_transactions(tenant_id,gift_card_id,amount_cents,reason,created_by)
    values(p_tenant_id,v_card.id,-p_amount_cents,'Pago de cuenta en TPV',auth.uid());
  return query select v_payment.payment_id, v_card.balance_cents-p_amount_cents;
end; $$;

revoke all on function public.record_gift_card_payment(uuid,uuid,uuid,integer,text,uuid) from public;
grant execute on function public.record_gift_card_payment(uuid,uuid,uuid,integer,text,uuid) to authenticated;
