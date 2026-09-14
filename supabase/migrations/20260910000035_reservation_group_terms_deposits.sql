-- Condiciones congeladas y depósitos de grupos. Nunca se almacenan datos de tarjeta.

create table public.reservation_group_terms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  min_party_size integer not null check (min_party_size > 0),
  cancellation_deadline timestamptz,
  cancellation_policy text not null,
  no_show_policy text not null,
  locale public.app_locale not null default 'es',
  created_at timestamptz not null default now(),
  unique (reservation_id)
);

create table public.reservation_deposits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'authorized', 'paid', 'partially_refunded', 'refunded', 'failed', 'waived')),
  provider text,
  provider_reference text,
  due_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);
create index reservation_deposits_reservation_idx on public.reservation_deposits (tenant_id, reservation_id);
alter table public.reservation_group_terms enable row level security;
alter table public.reservation_group_terms force row level security;
alter table public.reservation_deposits enable row level security;
alter table public.reservation_deposits force row level security;
create policy reservation_group_terms_read on public.reservation_group_terms for select using (public.is_tenant_member(tenant_id));
create policy reservation_group_terms_write on public.reservation_group_terms for all using (public.is_tenant_member(tenant_id)) with check (public.is_tenant_member(tenant_id));
create policy reservation_deposits_read on public.reservation_deposits for select using (public.is_tenant_member(tenant_id));
create policy reservation_deposits_write on public.reservation_deposits for insert with check (public.is_tenant_member(tenant_id));

create or replace function public.process_reservation_deposit_event(
  p_provider text, p_reference text, p_status text, p_paid_at timestamptz default null
)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('authorized', 'paid', 'partially_refunded', 'refunded', 'failed') then
    raise exception 'invalid_deposit_event';
  end if;
  update public.reservation_deposits
  set status = p_status, provider = coalesce(provider, p_provider),
      provider_reference = coalesce(provider_reference, p_reference),
      paid_at = case when p_status = 'paid' then coalesce(p_paid_at, now()) else paid_at end,
      refunded_at = case when p_status = 'refunded' then coalesce(p_paid_at, now()) else refunded_at end
  where provider_reference = p_reference or idempotency_key = p_reference;
  return found;
end;
$$;
revoke execute on function public.process_reservation_deposit_event(text, text, text, timestamptz) from public, anon, authenticated;
grant execute on function public.process_reservation_deposit_event(text, text, text, timestamptz) to service_role;
