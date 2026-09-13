create table public.tip_pool_entries (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade, tip_date date not null,
  amount_cents integer not null check (amount_cents >= 0), note text, created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), unique (tenant_id, venue_id, tip_date)
);
create table public.tip_pool_periods (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade, from_date date not null, to_date date not null,
  total_cents integer not null check (total_cents >= 0), closed_by uuid not null references auth.users(id),
  closed_at timestamptz not null default now(), check (to_date >= from_date)
);
create index tip_pool_entries_period_idx on public.tip_pool_entries(tenant_id, venue_id, tip_date);
select public.apply_tenant_rls('tip_pool_entries', array['owner','manager']::public.tenant_role[]);
select public.apply_tenant_rls('tip_pool_periods', array['owner','manager']::public.tenant_role[]);
