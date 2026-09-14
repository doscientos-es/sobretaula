create table public.timekeeping_pins (
  tenant_id uuid not null references public.tenants(id) on delete cascade, employee_id uuid not null references auth.users(id) on delete cascade,
  pin_hash text not null, updated_at timestamptz not null default now(), primary key (tenant_id, employee_id)
);
select public.apply_tenant_rls('timekeeping_pins', array['owner','manager']::public.tenant_role[]);
