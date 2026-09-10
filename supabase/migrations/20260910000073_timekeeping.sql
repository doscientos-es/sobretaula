create table public.timekeeping_events (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade, employee_id uuid not null references auth.users(id),
  event_type text not null check (event_type in ('clock_in','break_start','break_end','clock_out')), occurred_at timestamptz not null default now(), terminal_id text, created_at timestamptz not null default now()
);
create index timekeeping_events_employee_idx on public.timekeeping_events(tenant_id, employee_id, occurred_at);
select public.apply_tenant_rls('timekeeping_events', array['owner','manager','waiter','host']::public.tenant_role[]);
