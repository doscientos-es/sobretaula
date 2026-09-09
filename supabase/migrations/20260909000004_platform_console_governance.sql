-- Gobierno de plataforma: acceso de superadministradores, invitaciones de un
-- solo uso y trazabilidad de los cambios que afectan a tenants.

create table public.platform_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (length(btrim(email)) > 0),
  role public.platform_role not null,
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  invited_by uuid not null references auth.users (id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create table public.platform_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (action in (
    'platform_invitation_created',
    'platform_invitation_accepted',
    'platform_member_granted',
    'platform_member_role_changed',
    'platform_member_revoked',
    'tenant_status_changed'
  )),
  target_type text not null check (target_type in ('platform_invitation', 'platform_member', 'tenant')),
  target_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index platform_invitations_pending_idx on public.platform_invitations (expires_at)
  where accepted_at is null;
create index platform_audit_log_created_idx on public.platform_audit_log (created_at desc);

alter table public.platform_invitations enable row level security;
alter table public.platform_invitations force row level security;
alter table public.platform_audit_log enable row level security;
alter table public.platform_audit_log force row level security;

-- No hay escrituras directas: las funciones de abajo aplican la jerarquía,
-- verifican al usuario y registran la auditoría en una misma transacción.
drop policy platform_members_insert on public.platform_members;
drop policy platform_members_update on public.platform_members;
drop policy platform_members_delete on public.platform_members;
drop policy platform_members_read on public.platform_members;
drop policy tenants_platform_insert on public.tenants;
drop policy tenants_platform_delete on public.tenants;
drop policy tenants_update on public.tenants;

create policy platform_members_read on public.platform_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_owner());

create policy platform_invitations_read on public.platform_invitations
  for select to authenticated using (public.is_platform_owner());
create policy platform_audit_log_read on public.platform_audit_log
  for select to authenticated using (public.is_platform_owner());
create policy profiles_platform_owner_read on public.profiles
  for select to authenticated using (public.is_platform_owner());

create trigger platform_audit_log_append_only
  before update or delete on public.platform_audit_log
  for each row execute function public.forbid_mutation();

create or replace function public.create_platform_invitation(
  p_email text,
  p_role public.platform_role,
  p_token_hash text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.platform_invitations (email, role, token_hash, invited_by, expires_at, accepted_at)
  values (lower(btrim(p_email)), p_role, p_token_hash, auth.uid(), now() + interval '7 days', null)
  on conflict (email) do update set role = excluded.role, token_hash = excluded.token_hash,
    invited_by = excluded.invited_by, expires_at = excluded.expires_at, accepted_at = null,
    created_at = now();
  insert into public.platform_audit_log (actor_user_id, action, target_type, target_id, metadata)
  select auth.uid(), 'platform_invitation_created', 'platform_invitation', id,
    jsonb_build_object('email', lower(btrim(p_email)), 'role', p_role)
  from public.platform_invitations where email = lower(btrim(p_email));
end;
$$;

create or replace function public.grant_platform_member(p_user_id uuid, p_role public.platform_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_owner() then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into public.platform_members (user_id, role) values (p_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role;
  insert into public.platform_audit_log (actor_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'platform_member_granted', 'platform_member', p_user_id,
    jsonb_build_object('role', p_role));
end;
$$;

create or replace function public.set_platform_member_role(p_user_id uuid, p_role public.platform_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role public.platform_role;
  v_owner_count integer;
begin
  if not public.is_platform_owner() or p_user_id = auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select role into v_target_role from public.platform_members where user_id = p_user_id for update;
  if v_target_role is null then raise exception 'platform_member_not_found' using errcode = '22023'; end if;
  if v_target_role = 'platform_owner' and p_role <> 'platform_owner' then
    select count(*) into v_owner_count from public.platform_members where role = 'platform_owner';
    if v_owner_count <= 1 then raise exception 'last_platform_owner_cannot_be_changed' using errcode = '42501'; end if;
  end if;
  update public.platform_members set role = p_role where user_id = p_user_id;
  insert into public.platform_audit_log (actor_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'platform_member_role_changed', 'platform_member', p_user_id,
    jsonb_build_object('from', v_target_role, 'to', p_role));
end;
$$;

create or replace function public.revoke_platform_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_role public.platform_role;
  v_owner_count integer;
begin
  if not public.is_platform_owner() or p_user_id = auth.uid() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select role into v_target_role from public.platform_members where user_id = p_user_id for update;
  if v_target_role is null then raise exception 'platform_member_not_found' using errcode = '22023'; end if;
  if v_target_role = 'platform_owner' then
    select count(*) into v_owner_count from public.platform_members where role = 'platform_owner';
    if v_owner_count <= 1 then raise exception 'last_platform_owner_cannot_be_removed' using errcode = '42501'; end if;
  end if;
  delete from public.platform_members where user_id = p_user_id;
  insert into public.platform_audit_log (actor_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'platform_member_revoked', 'platform_member', p_user_id,
    jsonb_build_object('role', v_target_role));
end;
$$;

create or replace function public.accept_platform_invitation(p_token_hash text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_invitation public.platform_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'unauthenticated' using errcode = '42501'; end if;
  select * into v_invitation from public.platform_invitations
  where token_hash = p_token_hash and accepted_at is null and expires_at > now() for update;
  if v_invitation.id is null or lower(coalesce(auth.jwt() ->> 'email', '')) <> v_invitation.email then
    raise exception 'invitation_not_found_or_email_mismatch' using errcode = '42501';
  end if;
  insert into public.platform_members (user_id, role) values (auth.uid(), v_invitation.role)
  on conflict (user_id) do update set role = excluded.role;
  update public.platform_invitations set accepted_at = now() where id = v_invitation.id;
  insert into public.platform_audit_log (actor_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'platform_invitation_accepted', 'platform_member', auth.uid(),
    jsonb_build_object('role', v_invitation.role, 'invitation_id', v_invitation.id));
end;
$$;

create or replace function public.set_platform_tenant_status(
  p_tenant_id uuid,
  p_status public.tenant_status,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_previous_status public.tenant_status;
begin
  if not public.is_platform_owner() or p_status not in ('active', 'suspended')
    or length(btrim(p_reason)) < 5 then raise exception 'forbidden' using errcode = '42501'; end if;
  select status into v_previous_status from public.tenants where id = p_tenant_id for update;
  if v_previous_status is null then raise exception 'tenant_not_found' using errcode = '22023'; end if;
  if v_previous_status = p_status then return; end if;
  update public.tenants set status = p_status where id = p_tenant_id;
  insert into public.platform_audit_log (actor_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'tenant_status_changed', 'tenant', p_tenant_id,
    jsonb_build_object('from', v_previous_status, 'to', p_status, 'reason', btrim(p_reason)));
end;
$$;

revoke execute on function public.create_platform_invitation(text, public.platform_role, text) from public, anon;
revoke execute on function public.grant_platform_member(uuid, public.platform_role) from public, anon;
revoke execute on function public.set_platform_member_role(uuid, public.platform_role) from public, anon;
revoke execute on function public.revoke_platform_member(uuid) from public, anon;
revoke execute on function public.accept_platform_invitation(text) from public, anon;
revoke execute on function public.set_platform_tenant_status(uuid, public.tenant_status, text) from public, anon;
grant execute on function public.create_platform_invitation(text, public.platform_role, text) to authenticated;
grant execute on function public.grant_platform_member(uuid, public.platform_role) to authenticated;
grant execute on function public.set_platform_member_role(uuid, public.platform_role) to authenticated;
grant execute on function public.revoke_platform_member(uuid) to authenticated;
grant execute on function public.accept_platform_invitation(text) to authenticated;
grant execute on function public.set_platform_tenant_status(uuid, public.tenant_status, text) to authenticated;