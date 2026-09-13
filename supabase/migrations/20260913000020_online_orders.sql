create table if not exists public.online_orders (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade, venue_id uuid not null references public.venues(id) on delete cascade,
  guest_id uuid references public.guests(id) on delete set null, channel text not null default 'pickup' check (channel in ('pickup','delivery','partner')), status text not null default 'pending' check (status in ('pending','accepted','preparing','ready','completed','cancelled')),
  customer_name text not null, customer_phone text, items jsonb not null default '[]'::jsonb, total_cents integer not null check (total_cents >= 0), requested_for timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index if not exists online_orders_operational_idx on public.online_orders(tenant_id, venue_id, status, requested_for);
alter table public.online_orders enable row level security; alter table public.online_orders force row level security;
create policy online_orders_read on public.online_orders for select using (public.is_tenant_member(tenant_id));
create policy online_orders_write on public.online_orders for all using (public.has_tenant_role(tenant_id, array['owner','manager','waiter']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager','waiter']::public.tenant_role[]));
