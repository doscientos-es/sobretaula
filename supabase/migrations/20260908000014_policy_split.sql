-- Una política permisiva por acción y rol. `for all` duplicaba la evaluación
-- en cada SELECT, que es la operación más frecuente.

create or replace function public.apply_tenant_rls(p_table text, p_write_roles public.tenant_role[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_roles text := array_to_string(array(select quote_literal(r) from unnest(p_write_roles) as r), ', ');
  v_check text := format('public.has_tenant_role(tenant_id, array[%s]::public.tenant_role[])', v_roles);
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format('alter table public.%I force row level security', p_table);

  execute format('drop policy if exists %I on public.%I', p_table || '_read', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_write', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_insert', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_update', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_delete', p_table);

  execute format(
    'create policy %I on public.%I for select to authenticated using (public.is_member_of(tenant_id))',
    p_table || '_read', p_table
  );
  execute format(
    'create policy %I on public.%I for insert to authenticated with check (%s)',
    p_table || '_insert', p_table, v_check
  );
  execute format(
    'create policy %I on public.%I for update to authenticated using (%s) with check (%s)',
    p_table || '_update', p_table, v_check, v_check
  );
  execute format(
    'create policy %I on public.%I for delete to authenticated using (%s)',
    p_table || '_delete', p_table, v_check
  );
end;
$$;

revoke execute on function public.apply_tenant_rls(text, public.tenant_role[]) from public, anon, authenticated;

select public.apply_tenant_rls('venues', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('areas', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('floor_plan_versions', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('plan_elements', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('tables', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('table_placements', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('table_group_presets', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('services', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('availability_rules', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('closures', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('guests', array['owner', 'manager', 'host']::public.tenant_role[]);
select public.apply_tenant_rls('reservations', array['owner', 'manager', 'host', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('reservation_tables', array['owner', 'manager', 'host', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('holds', array['owner', 'manager', 'host']::public.tenant_role[]);
select public.apply_tenant_rls('waitlist', array['owner', 'manager', 'host']::public.tenant_role[]);
select public.apply_tenant_rls('table_sessions', array['owner', 'manager', 'host', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('menu_categories', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('menu_items', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('orders', array['owner', 'manager', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('order_items', array['owner', 'manager', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('payments', array['owner', 'manager', 'waiter']::public.tenant_role[]);

-- Tablas con política propia: mismo criterio, escritura separada de lectura.
drop policy tenants_platform_write on public.tenants;
create policy tenants_platform_insert on public.tenants
  for insert to authenticated with check (public.is_platform_owner());
create policy tenants_platform_delete on public.tenants
  for delete to authenticated using (public.is_platform_owner());
drop policy tenants_update_own on public.tenants;
create policy tenants_update on public.tenants
  for update to authenticated
  using (public.has_tenant_role(id, array['owner']::public.tenant_role[]) or public.is_platform_owner())
  with check (public.has_tenant_role(id, array['owner']::public.tenant_role[]) or public.is_platform_owner());

drop policy platform_members_write on public.platform_members;
create policy platform_members_insert on public.platform_members
  for insert to authenticated with check (public.is_platform_owner());
create policy platform_members_update on public.platform_members
  for update to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
create policy platform_members_delete on public.platform_members
  for delete to authenticated using (public.is_platform_owner());

drop policy memberships_manage on public.memberships;
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

drop policy plans_write on public.plans;
create policy plans_insert on public.plans
  for insert to authenticated with check (public.is_platform_owner());
create policy plans_update on public.plans
  for update to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
create policy plans_delete on public.plans
  for delete to authenticated using (public.is_platform_owner());

drop policy plan_entitlements_write on public.plan_entitlements;
create policy plan_entitlements_insert on public.plan_entitlements
  for insert to authenticated with check (public.is_platform_owner());
create policy plan_entitlements_update on public.plan_entitlements
  for update to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
create policy plan_entitlements_delete on public.plan_entitlements
  for delete to authenticated using (public.is_platform_owner());

drop policy subscriptions_write on public.subscriptions;
create policy subscriptions_insert on public.subscriptions
  for insert to authenticated with check (public.is_platform_owner());
create policy subscriptions_update on public.subscriptions
  for update to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
create policy subscriptions_delete on public.subscriptions
  for delete to authenticated using (public.is_platform_owner());

drop policy tenant_fiscal_settings_write on public.tenant_fiscal_settings;
create policy tenant_fiscal_settings_insert on public.tenant_fiscal_settings
  for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['owner']::public.tenant_role[]));
create policy tenant_fiscal_settings_update on public.tenant_fiscal_settings
  for update to authenticated
  using (public.has_tenant_role(tenant_id, array['owner']::public.tenant_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner']::public.tenant_role[]));

drop policy invoice_series_write on public.invoice_series;
create policy invoice_series_insert on public.invoice_series
  for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
create policy invoice_series_update on public.invoice_series
  for update to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

drop policy invitations_manage on public.invitations;
create policy invitations_read on public.invitations
  for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
create policy invitations_insert on public.invitations
  for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
create policy invitations_delete on public.invitations
  for delete to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
