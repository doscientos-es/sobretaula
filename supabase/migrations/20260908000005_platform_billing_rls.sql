-- Utilidad de migración: aplica el patrón RLS estándar de una tabla de tenant.
create or replace function public.apply_tenant_rls(p_table text, p_write_roles public.tenant_role[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_roles text := array_to_string(array(select quote_literal(r) from unnest(p_write_roles) as r), ', ');
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format('alter table public.%I force row level security', p_table);
  execute format(
    'create policy %I on public.%I for select to authenticated using (public.is_member_of(tenant_id))',
    p_table || '_read',
    p_table
  );
  execute format(
    'create policy %I on public.%I for all to authenticated '
    || 'using (public.has_tenant_role(tenant_id, array[%s]::public.tenant_role[])) '
    || 'with check (public.has_tenant_role(tenant_id, array[%s]::public.tenant_role[]))',
    p_table || '_write',
    p_table,
    v_roles,
    v_roles
  );
end;
$$;

revoke execute on function public.apply_tenant_rls(text, public.tenant_role[]) from public;

alter table public.plans enable row level security;
alter table public.plans force row level security;
alter table public.plan_entitlements enable row level security;
alter table public.plan_entitlements force row level security;
alter table public.subscriptions enable row level security;
alter table public.subscriptions force row level security;
alter table public.support_access_log enable row level security;
alter table public.support_access_log force row level security;
alter table public.invitations enable row level security;
alter table public.invitations force row level security;
alter table public.user_preferences enable row level security;
alter table public.user_preferences force row level security;

create policy plans_read on public.plans
  for select to authenticated using (is_public or public.is_platform_member());
create policy plans_write on public.plans
  for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy plan_entitlements_read on public.plan_entitlements
  for select to authenticated using (true);
create policy plan_entitlements_write on public.plan_entitlements
  for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());

create policy subscriptions_read on public.subscriptions
  for select to authenticated using (public.is_member_of(tenant_id) or public.is_platform_member());
create policy subscriptions_write on public.subscriptions
  for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());

-- El restaurante ve siempre quién de Doscientos ha entrado y por qué.
create policy support_access_log_read on public.support_access_log
  for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner']::public.tenant_role[]) or public.is_platform_member());
create policy support_access_log_insert on public.support_access_log
  for insert to authenticated
  with check (public.is_platform_member() and platform_user_id = (select auth.uid()));

create policy invitations_manage on public.invitations
  for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

create policy user_preferences_self on public.user_preferences
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

select public.apply_tenant_rls('venues', array['owner', 'manager']::public.tenant_role[]);
