-- RLS del núcleo de identidad. Denegación por defecto: sin política, sin acceso.

alter table public.tenants enable row level security;
alter table public.tenants force row level security;
alter table public.tenant_slug_history enable row level security;
alter table public.tenant_slug_history force row level security;
alter table public.platform_members enable row level security;
alter table public.platform_members force row level security;
alter table public.memberships enable row level security;
alter table public.memberships force row level security;

-- El tenant sólo lo ven sus miembros; el plano global lo ve entero.
create policy tenants_read_own on public.tenants
  for select to authenticated
  using (public.is_member_of(id) or public.is_platform_member());

create policy tenants_update_own on public.tenants
  for update to authenticated
  using (public.has_tenant_role(id, array['owner']::public.tenant_role[]))
  with check (public.has_tenant_role(id, array['owner']::public.tenant_role[]));

-- El alta y la suspensión de tenants son operaciones de plataforma.
create policy tenants_platform_write on public.tenants
  for all to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

create policy tenant_slug_history_read on public.tenant_slug_history
  for select to authenticated
  using (public.is_member_of(tenant_id) or public.is_platform_member());

create policy platform_members_read on public.platform_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_member());

create policy platform_members_write on public.platform_members
  for all to authenticated
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

create policy memberships_read on public.memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_member_of(tenant_id) or public.is_platform_member());

create policy memberships_manage on public.memberships
  for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
