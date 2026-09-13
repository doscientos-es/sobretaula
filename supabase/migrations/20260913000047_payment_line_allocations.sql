-- Asignación auditable de líneas a pagos para dividir cuentas por producto/persona.
create table public.payment_line_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  amount_cents integer not null check (amount_cents > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (payment_id, order_item_id)
);

create index payment_line_allocations_session_idx
  on public.payment_line_allocations(tenant_id, venue_id, payment_id);

select public.apply_tenant_rls(
  'payment_line_allocations',
  array['owner', 'manager', 'waiter']::public.tenant_role[]
);

comment on table public.payment_line_allocations is
  'Auditable link between a payment and the order lines it settles; populated only after payment confirmation.';

-- Wrapper transaccional: la función existente registra el pago y cualquier
-- error al validar/asignar líneas revierte toda la llamada.
create or replace function public.record_single_payment_with_allocations(
  p_tenant_id uuid,
  p_venue_id uuid,
  p_session_id uuid,
  p_amount_cents integer,
  p_method public.payment_method,
  p_tip_cents integer default 0,
  p_operation_id uuid default null,
  p_allocations jsonb default '[]'::jsonb
)
returns table(payment_id uuid, balance_cents integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_allocation jsonb;
  v_sum integer := 0;
  v_allocated_quantity integer;
  v_item record;
begin
  select * into v_payment from public.record_single_payment(
    p_tenant_id, p_venue_id, p_session_id, p_amount_cents,
    p_method, p_tip_cents, p_operation_id
  );
  -- Reintento idempotente: el pago y sus asignaciones ya existen.
  if v_payment.balance_cents is null then
    payment_id := v_payment.payment_id;
    balance_cents := null;
    return next;
    return;
  end if;
  if jsonb_typeof(p_allocations) <> 'array' then raise exception 'invalid_payment_allocations'; end if;
  for v_allocation in select value from jsonb_array_elements(p_allocations) loop
    select oi.id, oi.quantity, o.session_id into v_item
      from public.order_items oi join public.orders o on o.id = oi.order_id
      where oi.id = (v_allocation->>'orderItemId')::uuid
        and o.session_id = p_session_id and oi.tenant_id = p_tenant_id
      for update;
    if not found then raise exception 'payment_allocation_item_not_found'; end if;
    if (v_allocation->>'quantity')::integer < 1 or (v_allocation->>'quantity')::integer > v_item.quantity
      then raise exception 'invalid_payment_allocation_quantity'; end if;
    select coalesce(sum(pla.quantity), 0) into v_allocated_quantity
      from public.payment_line_allocations pla
      where pla.order_item_id = v_item.id;
    if v_allocated_quantity + (v_allocation->>'quantity')::integer > v_item.quantity
      then raise exception 'payment_allocation_quantity_already_settled'; end if;
    if (v_allocation->>'amountCents')::integer < 1 then raise exception 'invalid_payment_allocation_amount'; end if;
    v_sum := v_sum + (v_allocation->>'amountCents')::integer;
    insert into public.payment_line_allocations(
      tenant_id, venue_id, payment_id, order_item_id, quantity, amount_cents, created_by
    ) values (
      p_tenant_id, p_venue_id, v_payment.payment_id, (v_allocation->>'orderItemId')::uuid,
      (v_allocation->>'quantity')::integer, (v_allocation->>'amountCents')::integer, auth.uid()
    );
  end loop;
  if v_sum > p_amount_cents then raise exception 'payment_allocations_exceed_payment'; end if;
  payment_id := v_payment.payment_id;
  balance_cents := v_payment.balance_cents;
  return next;
end;
$$;

revoke execute on function public.record_single_payment_with_allocations(uuid, uuid, uuid, integer, public.payment_method, integer, uuid, jsonb) from public, anon;
grant execute on function public.record_single_payment_with_allocations(uuid, uuid, uuid, integer, public.payment_method, integer, uuid, jsonb) to authenticated;
