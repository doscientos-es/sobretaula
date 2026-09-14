-- Allow owners and managers to prepare a restaurant before payment without
-- making the operational tables available while the tenant is setup_pending.
create or replace function public.is_configuration_member_of(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.user_id = auth.uid()
      and m.tenant_id = p_tenant_id
      and m.status = 'active'
      and t.status in ('setup_pending', 'trial', 'active')
  );
$$;

create or replace function public.has_configuration_tenant_role(
  p_tenant_id uuid,
  p_roles public.tenant_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.user_id = auth.uid()
      and m.tenant_id = p_tenant_id
      and m.status = 'active'
      and m.role = any (p_roles)
      and t.status in ('setup_pending', 'trial', 'active')
  );
$$;

revoke execute on function public.is_configuration_member_of(uuid) from public, anon;
revoke execute on function public.has_configuration_tenant_role(uuid, public.tenant_role[]) from public, anon;
grant execute on function public.is_configuration_member_of(uuid) to authenticated;
grant execute on function public.has_configuration_tenant_role(uuid, public.tenant_role[]) to authenticated;

create or replace function public.apply_configuration_rls(
  p_table text,
  p_write_roles public.tenant_role[]
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_roles text := array_to_string(array(select quote_literal(r) from unnest(p_write_roles) as r), ', ');
  v_read text := 'public.is_configuration_member_of(tenant_id)';
  v_check text := format(
    'public.has_configuration_tenant_role(tenant_id, array[%s]::public.tenant_role[])',
    v_roles
  );
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format('alter table public.%I force row level security', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_read', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_insert', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_update', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_delete', p_table);
  execute format('create policy %I on public.%I for select to authenticated using (%s)', p_table || '_read', p_table, v_read);
  execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p_table || '_insert', p_table, v_check);
  execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', p_table || '_update', p_table, v_check, v_check);
  execute format('create policy %I on public.%I for delete to authenticated using (%s)', p_table || '_delete', p_table, v_check);
end;
$$;

revoke execute on function public.apply_configuration_rls(text, public.tenant_role[]) from public, anon, authenticated;

select public.apply_configuration_rls('venues', array['owner', 'manager']::public.tenant_role[]);
select public.apply_configuration_rls('areas', array['owner', 'manager']::public.tenant_role[]);
select public.apply_configuration_rls('floor_plan_versions', array['owner', 'manager']::public.tenant_role[]);
select public.apply_configuration_rls('plan_elements', array['owner', 'manager']::public.tenant_role[]);
select public.apply_configuration_rls('tables', array['owner', 'manager']::public.tenant_role[]);
select public.apply_configuration_rls('table_group_presets', array['owner', 'manager']::public.tenant_role[]);
select public.apply_configuration_rls('services', array['owner', 'manager']::public.tenant_role[]);
select public.apply_configuration_rls('availability_rules', array['owner', 'manager']::public.tenant_role[]);
select public.apply_configuration_rls('menu_categories', array['owner', 'manager']::public.tenant_role[]);
select public.apply_configuration_rls('menu_items', array['owner', 'manager']::public.tenant_role[]);
select public.apply_configuration_rls('menu_modifier_groups', array['owner', 'manager']::public.tenant_role[]);
select public.apply_configuration_rls('menu_modifier_options', array['owner', 'manager']::public.tenant_role[]);
select public.apply_configuration_rls('menu_item_channel_prices', array['owner', 'manager']::public.tenant_role[]);
select public.apply_configuration_rls('reservation_terms_versions', array['owner', 'manager']::public.tenant_role[]);

drop policy if exists venues_read on public.venues;
create policy venues_read on public.venues
  for select to authenticated
  using (
    (public.is_configuration_member_of(tenant_id) and public.has_venue_access(id))
    or public.is_platform_member()
  );
