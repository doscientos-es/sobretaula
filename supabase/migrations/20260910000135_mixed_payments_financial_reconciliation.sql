-- Agrupación atómica de pagos mixtos y conciliación de caja.
create table public.payment_batches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id) on delete cascade,
  operation_id uuid,
  total_cents integer not null check (total_cents > 0),
  status text not null default 'completed' check (status in ('completed', 'voided')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (tenant_id, operation_id)
);

alter table public.payments
  add column if not exists batch_id uuid references public.payment_batches(id) on delete set null;

create index payment_batches_session_idx on public.payment_batches(tenant_id, session_id, created_at desc);
create index payments_batch_idx on public.payments(tenant_id, batch_id);

select public.apply_tenant_rls('payment_batches', array['owner','manager','waiter']::public.tenant_role[]);

create table public.cash_reconciliations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  register_id uuid not null references public.cash_registers(id) on delete cascade,
  expected_cash_cents integer not null,
  counted_cash_cents integer not null check (counted_cash_cents >= 0),
  variance_cents integer not null,
  note text,
  reconciled_by uuid references auth.users(id),
  reconciled_at timestamptz not null default now()
);

create index cash_reconciliations_register_idx on public.cash_reconciliations(tenant_id, register_id, reconciled_at desc);
select public.apply_tenant_rls('cash_reconciliations', array['owner','manager']::public.tenant_role[]);

create or replace function public.record_mixed_payment(
  p_tenant_id uuid,
  p_venue_id uuid,
  p_session_id uuid,
  p_lines jsonb,
  p_operation_id uuid default null
)
returns table(payment_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session record;
  v_line jsonb;
  v_batch_id uuid;
  v_amount integer;
  v_tip integer;
  v_total integer := 0;
  v_balance integer;
  v_gross integer;
  v_paid integer;
  v_discount integer;
  v_existing uuid;
begin
  if not public.has_tenant_role(
    p_tenant_id,
    array['owner', 'manager', 'waiter']::public.tenant_role[]
  ) then raise exception 'payment_forbidden'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) < 2 or jsonb_array_length(p_lines) > 6 then
    raise exception 'invalid_payment_batch';
  end if;
  if (
    select count(distinct value->>'method')
    from jsonb_array_elements(p_lines)
  ) < 2 then
    raise exception 'payment_batch_requires_two_methods';
  end if;
  if p_operation_id is not null then
    select id into v_existing from public.payment_batches where tenant_id = p_tenant_id and operation_id = p_operation_id;
    if found then return query select id from public.payments where batch_id = v_existing order by paid_at, id; return; end if;
  end if;
  select id, discount_cents, status into v_session from public.table_sessions
    where id = p_session_id and tenant_id = p_tenant_id and venue_id = p_venue_id for update;
  if not found or v_session.status <> 'open' then raise exception 'payment_session_not_open'; end if;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    if (v_line->>'method') not in ('cash','card','transfer','voucher','other') then raise exception 'invalid_payment_method'; end if;
    v_amount := (v_line->>'amountCents')::integer;
    v_tip := coalesce((v_line->>'tipCents')::integer, 0);
    if v_amount is null or v_amount <= 0 or v_tip < 0 then raise exception 'invalid_payment_amount'; end if;
    v_total := v_total + v_amount;
  end loop;
  select coalesce(sum(oi.quantity * (oi.unit_price_cents + coalesce(mods.modifier_cents, 0))), 0),
    coalesce(v_session.discount_cents, 0)
    into v_gross, v_discount
    from public.orders o join public.order_items oi on oi.order_id = o.id
    left join lateral (
      select coalesce(sum(price_delta_cents), 0) modifier_cents from public.order_item_modifiers m where m.order_item_id = oi.id
    ) mods on true
    where o.session_id = p_session_id and oi.status <> 'cancelled';
  select coalesce(sum(p.amount_cents), 0) - coalesce((select sum(r.amount_cents) from public.payment_refunds r join public.payments rp on rp.id = r.payment_id where rp.session_id = p_session_id), 0)
    into v_paid from public.payments p where p.session_id = p_session_id;
  v_balance := greatest(0, v_gross - v_discount - v_paid);
  if v_total > v_balance then raise exception 'payment_exceeds_balance'; end if;
  insert into public.payment_batches (tenant_id, venue_id, session_id, operation_id, total_cents, created_by)
    values (p_tenant_id, p_venue_id, p_session_id, p_operation_id, v_total, auth.uid()) returning id into v_batch_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    insert into public.payments (tenant_id, session_id, method, amount_cents, tip_cents, created_by, batch_id)
      values (p_tenant_id, p_session_id, (v_line->>'method')::public.payment_method, (v_line->>'amountCents')::integer, coalesce((v_line->>'tipCents')::integer, 0), auth.uid(), v_batch_id)
      returning id into v_existing;
    payment_id := v_existing;
    return next;
  end loop;
end;
$$;
revoke execute on function public.record_mixed_payment(uuid,uuid,uuid,jsonb,uuid) from public, anon;
grant execute on function public.record_mixed_payment(uuid,uuid,uuid,jsonb,uuid) to authenticated;

create or replace function public.reconcile_cash_register(
  p_tenant_id uuid, p_venue_id uuid, p_register_id uuid, p_counted_cash_cents integer, p_note text default null
)
returns table(reconciliation_id uuid, expected_cash_cents integer, variance_cents integer)
language plpgsql security definer set search_path = public as $$
declare v_expected integer; v_id uuid;
begin
  if not public.has_tenant_role(
    p_tenant_id,
    array['owner', 'manager']::public.tenant_role[]
  ) then raise exception 'reconciliation_forbidden'; end if;
  if p_counted_cash_cents < 0 then raise exception 'invalid_counted_cash'; end if;
  select
    r.opening_float_cents
    + coalesce((
      select sum(case when m.kind = 'in' then m.amount_cents else -m.amount_cents end)
      from public.cash_movements m
      where m.register_id = r.id and m.tenant_id = p_tenant_id
    ), 0)
    + coalesce((
      select sum(p.amount_cents)
      from public.payments p
      join public.table_sessions s on s.id = p.session_id
      where p.tenant_id = p_tenant_id
        and s.tenant_id = p_tenant_id
        and s.venue_id = p_venue_id
        and p.method = 'cash'
        and p.paid_at >= r.opened_at
        and p.paid_at <= coalesce(r.closed_at, now())
    ), 0)
    - coalesce((
      select sum(pr.amount_cents)
      from public.payment_refunds pr
      join public.payments p on p.id = pr.payment_id
      join public.table_sessions s on s.id = p.session_id
      where pr.tenant_id = p_tenant_id
        and p.tenant_id = p_tenant_id
        and s.venue_id = p_venue_id
        and p.method = 'cash'
        and pr.created_at >= r.opened_at
        and pr.created_at <= coalesce(r.closed_at, now())
    ), 0)
    into v_expected
  from public.cash_registers r
  where r.id = p_register_id and r.tenant_id = p_tenant_id and r.venue_id = p_venue_id;
  if v_expected is null then raise exception 'cash_register_not_found'; end if;
  insert into public.cash_reconciliations (tenant_id, venue_id, register_id, expected_cash_cents, counted_cash_cents, variance_cents, note, reconciled_by)
    values (p_tenant_id, p_venue_id, p_register_id, v_expected, p_counted_cash_cents, p_counted_cash_cents - v_expected, p_note, auth.uid()) returning id into v_id;
  return query select v_id, v_expected, p_counted_cash_cents - v_expected;
end;
$$;
revoke execute on function public.reconcile_cash_register(uuid,uuid,uuid,integer,text) from public, anon;
grant execute on function public.reconcile_cash_register(uuid,uuid,uuid,integer,text) to authenticated;
