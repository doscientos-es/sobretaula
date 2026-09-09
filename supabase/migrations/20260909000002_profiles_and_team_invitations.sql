-- Perfiles globales mínimos para mostrar la plantilla sin exponer auth.users.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  email text not null check (length(btrim(email)) > 0),
  created_at timestamptz not null default now()
);

create unique index profiles_email_lower_unique on public.profiles (lower(email));

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, email)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''), split_part(new.email, '@', 1)),
    lower(new.email)
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger auth_user_profile_created
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

-- Las cuentas creadas antes de este trigger también deben poder aparecer en la plantilla.
insert into public.profiles (user_id, display_name, email)
select
  u.id,
  coalesce(nullif(btrim(u.raw_user_meta_data ->> 'display_name'), ''), split_part(u.email, '@', 1)),
  lower(u.email)
from auth.users u
on conflict (user_id) do nothing;

create or replace function public.shares_active_tenant_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() = p_user_id or exists (
    select 1
    from public.memberships actor
    join public.memberships colleague on colleague.tenant_id = actor.tenant_id
    where actor.user_id = auth.uid()
      and actor.status = 'active'
      and colleague.user_id = p_user_id
      and colleague.status = 'active'
  );
$$;

alter table public.profiles enable row level security;
alter table public.profiles force row level security;
create policy profiles_read on public.profiles
  for select to authenticated using (public.shares_active_tenant_with(user_id));
revoke execute on function public.shares_active_tenant_with(uuid) from public, anon;
grant execute on function public.shares_active_tenant_with(uuid) to authenticated;

-- Los cambios de plantilla no se exponen directamente por PostgREST. Las dos
-- funciones siguientes validan la jerarquía también al ejecutarse bajo RLS.
drop policy memberships_insert on public.memberships;
drop policy memberships_update on public.memberships;
drop policy memberships_delete on public.memberships;

create or replace function public.upsert_tenant_member(
  p_tenant_id uuid,
  p_user_id uuid,
  p_role public.tenant_role
)
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
  where tenant_id = p_tenant_id and user_id = p_user_id;

  if v_actor_role = 'owner' then
    if p_role = 'owner' or v_target_role = 'owner' then
      raise exception 'owner_membership_cannot_be_changed' using errcode = '42501';
    end if;
  elsif v_actor_role = 'manager' then
    if p_role not in ('host', 'waiter', 'accountant')
      or v_target_role in ('owner', 'manager') then
      raise exception 'manager_cannot_manage_this_role' using errcode = '42501';
    end if;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.memberships (tenant_id, user_id, role, status)
  values (p_tenant_id, p_user_id, p_role, 'active')
  on conflict (tenant_id, user_id) do update
  set role = excluded.role, status = 'active';
end;
$$;

create or replace function public.suspend_tenant_member(p_tenant_id uuid, p_user_id uuid)
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

  if v_target_role is null then raise exception 'membership_not_found' using errcode = '22023'; end if;
  if v_target_role = 'owner' or p_user_id = auth.uid() then
    raise exception 'owner_or_self_membership_cannot_be_suspended' using errcode = '42501';
  end if;
  if v_actor_role = 'owner' then null;
  elsif v_actor_role = 'manager' and v_target_role not in ('owner', 'manager') then null;
  else raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.memberships set status = 'suspended'
  where tenant_id = p_tenant_id and user_id = p_user_id;
end;
$$;

revoke execute on function public.upsert_tenant_member(uuid, uuid, public.tenant_role) from public, anon;
revoke execute on function public.suspend_tenant_member(uuid, uuid) from public, anon;
grant execute on function public.upsert_tenant_member(uuid, uuid, public.tenant_role) to authenticated;
grant execute on function public.suspend_tenant_member(uuid, uuid) to authenticated;

-- La invitación puede prepararse durante setup_pending: el restaurante puede
-- montar su equipo antes de autorizar el cobro, pero no puede operar aún.
drop policy invitations_read on public.invitations;
drop policy invitations_insert on public.invitations;
drop policy invitations_delete on public.invitations;
create policy invitations_read on public.invitations
  for select to authenticated using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
create policy invitations_insert on public.invitations
  for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
create policy invitations_update on public.invitations
  for update to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
create policy invitations_delete on public.invitations
  for delete to authenticated using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

create or replace function public.accept_tenant_invitation(p_token_hash text)
returns table (tenant_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invitation public.invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  select * into v_invitation from public.invitations
  where token_hash = p_token_hash and expires_at > now()
  for update;
  if v_invitation.id is null then raise exception 'invitation_not_found_or_expired' using errcode = '22023'; end if;
  if lower(v_invitation.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'invitation_email_mismatch' using errcode = '42501';
  end if;

  insert into public.memberships (tenant_id, user_id, role, status)
  values (v_invitation.tenant_id, auth.uid(), v_invitation.role, 'active')
  on conflict (tenant_id, user_id) do update set role = excluded.role, status = 'active';
  update public.invitations set accepted_at = coalesce(accepted_at, now()) where id = v_invitation.id;

  return query select t.slug from public.tenants t where t.id = v_invitation.tenant_id;
end;
$$;

revoke execute on function public.accept_tenant_invitation(text) from public, anon;
grant execute on function public.accept_tenant_invitation(text) to authenticated;