-- El equipo puede prepararse durante setup_pending; la operativa sigue
-- bloqueada hasta trial/active mediante las policies operativas.

drop policy if exists memberships_insert on public.memberships;
drop policy if exists memberships_update on public.memberships;
drop policy if exists memberships_delete on public.memberships;

create policy memberships_insert on public.memberships
  for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

create policy memberships_update on public.memberships
  for update to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

create policy memberships_delete on public.memberships
  for delete to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

drop policy if exists invitations_read on public.invitations;
drop policy if exists invitations_insert on public.invitations;
drop policy if exists invitations_update on public.invitations;
drop policy if exists invitations_delete on public.invitations;

create policy invitations_read on public.invitations
  for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

create policy invitations_update on public.invitations
  for update to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

create policy invitations_delete on public.invitations
  for delete to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
