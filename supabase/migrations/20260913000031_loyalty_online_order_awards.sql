alter table public.loyalty_transactions
  add column if not exists source_online_order_id uuid references public.online_orders(id) on delete set null;
create unique index if not exists loyalty_transactions_online_order_idx
  on public.loyalty_transactions(source_online_order_id) where source_online_order_id is not null;

create or replace function public.award_loyalty_for_online_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_guest_id uuid;
  v_points integer;
  v_transaction_id uuid;
begin
  if new.payment_status <> 'paid' or old.payment_status = 'paid' then return new; end if;
  v_points := floor(new.total_cents / 100.0)::integer;
  if v_points <= 0 then return new; end if;
  v_guest_id := new.guest_id;
  if v_guest_id is null and nullif(btrim(new.customer_phone), '') is not null then
    select id into v_guest_id from public.guests where tenant_id = new.tenant_id and phone = btrim(new.customer_phone) limit 1;
  end if;
  if v_guest_id is null then return new; end if;
  insert into public.loyalty_transactions(tenant_id, guest_id, points, reason, source_online_order_id)
    values (new.tenant_id, v_guest_id, v_points, 'Pedido online cobrado', new.id)
    on conflict (source_online_order_id) do nothing returning id into v_transaction_id;
  if v_transaction_id is null then return new; end if;
  insert into public.loyalty_accounts(tenant_id, guest_id, points, lifetime_points)
    values (new.tenant_id, v_guest_id, v_points, v_points)
    on conflict (tenant_id, guest_id) do update set points = loyalty_accounts.points + excluded.points, lifetime_points = loyalty_accounts.lifetime_points + excluded.lifetime_points, updated_at = now();
  return new;
end; $$;
revoke all on function public.award_loyalty_for_online_order() from public;
create trigger online_orders_award_loyalty after update of payment_status on public.online_orders for each row execute function public.award_loyalty_for_online_order();
