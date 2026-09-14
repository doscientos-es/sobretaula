create table if not exists public.loyalty_accounts (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade, points integer not null default 0 check (points >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(tenant_id, guest_id)
);
create table if not exists public.loyalty_transactions (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade, points integer not null check (points <> 0), reason text not null, created_by uuid references auth.users(id), created_at timestamptz not null default now()
);
alter table public.loyalty_accounts enable row level security; alter table public.loyalty_transactions enable row level security;
create policy loyalty_accounts_select on public.loyalty_accounts for select to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager','accountant','waiter']::public.tenant_role[]));
create policy loyalty_accounts_insert on public.loyalty_accounts for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy loyalty_accounts_update on public.loyalty_accounts for update to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create policy loyalty_transactions_select on public.loyalty_transactions for select to authenticated using (public.has_tenant_role(tenant_id, array['owner','manager','accountant']::public.tenant_role[]));
create policy loyalty_transactions_insert on public.loyalty_transactions for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner','manager']::public.tenant_role[]));
create or replace function public.adjust_loyalty_points(p_tenant_id uuid, p_guest_id uuid, p_points integer, p_reason text) returns void language plpgsql security invoker set search_path=public as $$
begin
  if not public.has_tenant_role(p_tenant_id, array['owner','manager']::public.tenant_role[]) then raise exception 'forbidden'; end if;
  if p_points = 0 or length(btrim(p_reason)) = 0 then raise exception 'invalid_loyalty_adjustment'; end if;
  insert into loyalty_accounts(tenant_id, guest_id, points, lifetime_points) values (p_tenant_id, p_guest_id, greatest(p_points,0), greatest(p_points,0)) on conflict (tenant_id,guest_id) do update set points=loyalty_accounts.points+p_points, lifetime_points=loyalty_accounts.lifetime_points+greatest(p_points,0), updated_at=now();
  if (select points from loyalty_accounts where tenant_id=p_tenant_id and guest_id=p_guest_id) < 0 then raise exception 'insufficient_loyalty_points'; end if;
  insert into loyalty_transactions(tenant_id,guest_id,points,reason,created_by) values(p_tenant_id,p_guest_id,p_points,p_reason,auth.uid());
end; $$;
revoke all on function public.adjust_loyalty_points(uuid,uuid,integer,text) from public; grant execute on function public.adjust_loyalty_points(uuid,uuid,integer,text) to authenticated;

create or replace function public.redeem_loyalty_points(p_tenant_id uuid, p_guest_id uuid, p_points integer, p_reward text) returns void language plpgsql security invoker set search_path=public as $$
begin
  if not public.has_tenant_role(p_tenant_id, array['owner','manager','waiter']::public.tenant_role[]) then raise exception 'forbidden'; end if;
  if p_points <= 0 or length(btrim(p_reward)) = 0 then raise exception 'invalid_loyalty_redemption'; end if;
  update loyalty_accounts set points = points - p_points, updated_at = now() where tenant_id = p_tenant_id and guest_id = p_guest_id and points >= p_points;
  if not found then raise exception 'insufficient_loyalty_points'; end if;
  insert into loyalty_transactions(tenant_id, guest_id, points, reason, created_by) values(p_tenant_id, p_guest_id, -p_points, btrim(p_reward), auth.uid());
end; $$;
revoke all on function public.redeem_loyalty_points(uuid,uuid,integer,text) from public; grant execute on function public.redeem_loyalty_points(uuid,uuid,integer,text) to authenticated;
