alter table public.loyalty_transactions
  add column if not exists source_payment_id uuid references public.payments(id) on delete set null;
create unique index if not exists loyalty_transactions_payment_idx
  on public.loyalty_transactions(source_payment_id) where source_payment_id is not null;

create or replace function public.award_loyalty_for_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_guest_id uuid;
  v_points integer;
  v_transaction_id uuid;
begin
  select r.guest_id into v_guest_id
    from public.table_sessions s
    join public.reservations r on r.id = s.reservation_id
   where s.id = new.session_id and r.guest_id is not null;
  if v_guest_id is null then return new; end if;
  v_points := floor(new.amount_cents / 100.0)::integer;
  if v_points <= 0 then return new; end if;
  insert into public.loyalty_transactions(tenant_id, guest_id, points, reason, source_payment_id)
    values (new.tenant_id, v_guest_id, v_points, 'Compra registrada automáticamente', new.id)
    on conflict (source_payment_id) do nothing
    returning id into v_transaction_id;
  if v_transaction_id is null then return new; end if;
  insert into public.loyalty_accounts(tenant_id, guest_id, points, lifetime_points)
    values (new.tenant_id, v_guest_id, v_points, v_points)
    on conflict (tenant_id, guest_id) do update set
      points = loyalty_accounts.points + excluded.points,
      lifetime_points = loyalty_accounts.lifetime_points + excluded.lifetime_points,
      updated_at = now();
  return new;
end; $$;
revoke all on function public.award_loyalty_for_payment() from public;
create trigger payments_award_loyalty
  after insert on public.payments for each row execute function public.award_loyalty_for_payment();
