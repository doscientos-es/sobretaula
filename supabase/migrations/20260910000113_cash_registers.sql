-- Caja por local y turno. Los movimientos son append-only para conservar el arqueo.
create table public.cash_registers (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade, opened_by uuid references auth.users(id),
  opened_at timestamptz not null default now(), opening_float_cents integer not null check (opening_float_cents >= 0),
  closed_by uuid references auth.users(id), closed_at timestamptz, counted_cash_cents integer check (counted_cash_cents >= 0),
  status text not null default 'open' check (status in ('open','closed'))
);
create unique index cash_registers_one_open_per_venue on public.cash_registers(tenant_id, venue_id) where status = 'open';
create table public.cash_movements (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  register_id uuid not null references public.cash_registers(id) on delete cascade, kind text not null check (kind in ('in','out')),
  amount_cents integer not null check (amount_cents > 0), reason text not null, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index cash_movements_register_idx on public.cash_movements(register_id, created_at);
select public.apply_tenant_rls('cash_registers', array['owner','manager']::public.tenant_role[]);
select public.apply_tenant_rls('cash_movements', array['owner','manager']::public.tenant_role[]);
