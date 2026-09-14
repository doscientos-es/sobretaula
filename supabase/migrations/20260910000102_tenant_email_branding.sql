-- Marca de cada restaurante para los correos transaccionales.

create table public.tenant_email_branding (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  email_from_name text not null check (length(btrim(email_from_name)) between 1 and 120),
  logo_url text check (logo_url is null or logo_url ~ '^https://'),
  primary_color text not null default '#0f766e' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  reply_to_email text check (reply_to_email is null or reply_to_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tenant_email_branding enable row level security;
alter table public.tenant_email_branding force row level security;

create policy tenant_email_branding_read on public.tenant_email_branding
  for select to authenticated
  using (public.is_member_of(tenant_id));

create policy tenant_email_branding_manage on public.tenant_email_branding
  for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

create trigger tenant_email_branding_set_updated_at
  before update on public.tenant_email_branding
  for each row execute function public.set_updated_at();
