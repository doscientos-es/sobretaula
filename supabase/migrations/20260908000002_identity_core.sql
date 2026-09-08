-- Núcleo de identidad: tenants, pertenencia y plano global.

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$'),
  name text not null check (length(btrim(name)) > 0),
  status public.tenant_status not null default 'trial',
  default_locale public.app_locale not null default 'es',
  timezone text not null default 'Europe/Madrid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_slug_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  slug text not null unique,
  released_at timestamptz not null default now()
);

create table public.platform_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role public.platform_role not null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.tenant_role not null,
  status public.membership_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index memberships_user_idx on public.memberships (user_id) where status = 'active';

create trigger tenants_set_updated_at before update on public.tenants
  for each row execute function public.set_updated_at();
create trigger memberships_set_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();

-- Autorización. SECURITY DEFINER para poder consultarse desde políticas RLS
-- sin recursión, con search_path fijo y referencias cualificadas.
create or replace function public.is_platform_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_members m where m.user_id = auth.uid());
$$;

create or replace function public.is_platform_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.platform_members m
    where m.user_id = auth.uid() and m.role = 'platform_owner'
  );
$$;

create or replace function public.is_member_of(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.tenant_id = p_tenant_id and m.status = 'active'
  );
$$;

create or replace function public.has_tenant_role(p_tenant_id uuid, p_roles public.tenant_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid()
      and m.tenant_id = p_tenant_id
      and m.status = 'active'
      and m.role = any (p_roles)
  );
$$;

revoke execute on function public.is_platform_member() from public;
revoke execute on function public.is_platform_owner() from public;
revoke execute on function public.is_member_of(uuid) from public;
revoke execute on function public.has_tenant_role(uuid, public.tenant_role[]) from public;
grant execute on function public.is_platform_member() to authenticated;
grant execute on function public.is_platform_owner() to authenticated;
grant execute on function public.is_member_of(uuid) to authenticated;
grant execute on function public.has_tenant_role(uuid, public.tenant_role[]) to authenticated;
