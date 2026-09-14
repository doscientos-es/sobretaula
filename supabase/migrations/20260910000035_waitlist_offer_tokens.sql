-- Tokens públicos de oferta: el secreto solo viaja en el enlace, nunca se almacena.

create table public.waitlist_offer_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  waitlist_id uuid not null references public.waitlist (id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index waitlist_offer_tokens_active_idx on public.waitlist_offer_tokens (token_hash, expires_at) where used_at is null and revoked_at is null;
alter table public.waitlist_offer_tokens enable row level security;
alter table public.waitlist_offer_tokens force row level security;
create policy waitlist_offer_tokens_read on public.waitlist_offer_tokens for select using (public.is_tenant_member(tenant_id));

create or replace function public.create_waitlist_offer_token(p_tenant_id uuid, p_waitlist_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare secret text := encode(gen_random_bytes(24), 'hex');
begin
  if not public.is_tenant_member(p_tenant_id) then raise exception 'forbidden'; end if;
  insert into public.waitlist_offer_tokens (tenant_id, waitlist_id, token_hash, expires_at)
  select p_tenant_id, id, encode(digest(secret, 'sha256'), 'hex'), offer_expires_at
  from public.waitlist where id = p_waitlist_id and tenant_id = p_tenant_id and status = 'offered';
  if not found then raise exception 'waitlist_offer_unavailable'; end if;
  return secret;
end;
$$;
grant execute on function public.create_waitlist_offer_token(uuid, uuid) to authenticated;

create or replace function public.respond_waitlist_offer(p_token_hash text, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare token_row public.waitlist_offer_tokens; entry public.waitlist;
begin
  select * into token_row from public.waitlist_offer_tokens
  where token_hash = p_token_hash and used_at is null and revoked_at is null and expires_at > now()
  for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  select * into entry from public.waitlist where id = token_row.waitlist_id for update;
  if entry.status <> 'offered' or entry.offer_expires_at is null or entry.offer_expires_at <= now() then
    update public.waitlist_offer_tokens set revoked_at = now() where id = token_row.id;
    return jsonb_build_object('ok', false, 'reason', 'unavailable');
  end if;
  update public.waitlist_offer_tokens set used_at = now() where id = token_row.id;
  update public.waitlist set status = case when p_accept then 'accepted' else 'cancelled' end,
    exit_reason = case when p_accept then null else 'offer_rejected' end
    where id = entry.id;
  return jsonb_build_object('ok', true, 'accepted', p_accept, 'waitlist_id', entry.id);
end;
$$;
revoke execute on function public.respond_waitlist_offer(text, boolean) from public, authenticated;
grant execute on function public.respond_waitlist_offer(text, boolean) to anon;

create or replace function public.get_waitlist_offer(p_token_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  select jsonb_build_object('status', w.status, 'party_size', w.party_size, 'requested_for', w.requested_for, 'expires_at', t.expires_at)
    into result from public.waitlist_offer_tokens t join public.waitlist w on w.id = t.waitlist_id
   where t.token_hash = p_token_hash and t.used_at is null and t.revoked_at is null and t.expires_at > now() and w.status = 'offered';
  return coalesce(result, jsonb_build_object('status', 'expired'));
end;
$$;
grant execute on function public.get_waitlist_offer(text) to anon;
