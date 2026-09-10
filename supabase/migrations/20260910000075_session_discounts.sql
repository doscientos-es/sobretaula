alter table public.table_sessions add column if not exists discount_cents integer not null default 0 check (discount_cents >= 0);
create table public.session_discount_audits (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.table_sessions(id) on delete cascade, discount_cents integer not null check (discount_cents > 0), reason text not null,
  created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
select public.apply_tenant_rls('session_discount_audits', array['owner','manager']::public.tenant_role[]);
