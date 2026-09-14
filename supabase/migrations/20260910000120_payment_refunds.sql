create table public.payment_refunds (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  payment_id uuid not null references public.payments(id) on delete restrict, amount_cents integer not null check (amount_cents > 0),
  reason text not null, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index payment_refunds_payment_idx on public.payment_refunds(tenant_id, payment_id);
select public.apply_tenant_rls('payment_refunds', array['owner','manager']::public.tenant_role[]);
