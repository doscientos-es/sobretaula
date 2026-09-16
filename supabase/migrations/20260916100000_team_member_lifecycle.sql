-- Completa el ciclo de vida del equipo: revocar invitaciones y eliminar
-- membresías sin permitir que un manager toque roles administrativos.

create or replace function public.remove_tenant_member(p_tenant_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.tenant_role;
  v_target_role public.tenant_role;
begin
  select role into v_actor_role from public.memberships
  where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active';
  select role into v_target_role from public.memberships
  where tenant_id = p_tenant_id and user_id = p_user_id and status = 'active';

  if v_target_role is null then
    raise exception 'membership_not_found' using errcode = '22023';
  end if;
  if p_user_id = auth.uid() or v_target_role = 'owner' then
    raise exception 'owner_or_self_membership_cannot_be_removed' using errcode = '42501';
  end if;
  if v_actor_role = 'owner' then
    null;
  elsif v_actor_role = 'manager' and v_target_role not in ('owner', 'manager') then
    null;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.memberships
  where tenant_id = p_tenant_id and user_id = p_user_id;
end;
$$;

create or replace function public.revoke_tenant_invitation(p_tenant_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_role public.tenant_role;
begin
  select role into v_actor_role from public.memberships
  where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active';
  if v_actor_role not in ('owner', 'manager') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  delete from public.invitations
  where tenant_id = p_tenant_id
    and lower(email) = lower(btrim(p_email))
    and accepted_at is null;
end;
$$;

revoke execute on function public.remove_tenant_member(uuid, uuid) from public, anon;
revoke execute on function public.revoke_tenant_invitation(uuid, text) from public, anon;
grant execute on function public.remove_tenant_member(uuid, uuid) to authenticated;
grant execute on function public.revoke_tenant_invitation(uuid, text) to authenticated;
