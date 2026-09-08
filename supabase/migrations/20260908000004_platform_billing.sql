-- Planes, suscripción, soporte auditado, invitaciones, preferencias y locales.

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.plan_entitlements (
  plan_id uuid not null references public.plans (id) on delete cascade,
  module_code text not null,
  limit_value integer,
  primary key (plan_id, module_code)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  plan_id uuid not null references public.plans (id),
  status public.subscription_status not null default 'trialing',
  current_period_start date not null default current_date,
  current_period_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id)
);

create table public.support_access_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  platform_user_id uuid not null references auth.users (id),
  reason text not null check (length(btrim(reason)) > 0),
  granted_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  email text not null,
  role public.tenant_role not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  locale public.app_locale not null default 'es',
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  name text not null,
  address_line text,
  city text,
  postal_code text,
  country_code text not null default 'ES',
  timezone text not null default 'Europe/Madrid',
  capacity integer check (capacity is null or capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create trigger subscriptions_set_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();
create trigger user_preferences_set_updated_at before update on public.user_preferences
  for each row execute function public.set_updated_at();
create trigger venues_set_updated_at before update on public.venues
  for each row execute function public.set_updated_at();

create trigger support_access_log_append_only
  before update or delete on public.support_access_log
  for each row execute function public.forbid_mutation();
