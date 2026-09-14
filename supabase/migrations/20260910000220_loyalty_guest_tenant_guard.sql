create index if not exists guests_tenant_id_idx
  on public.guests (tenant_id, id);

create index if not exists loyalty_accounts_tenant_points_idx
  on public.loyalty_accounts (tenant_id, points desc, guest_id asc);

create index if not exists loyalty_transactions_tenant_created_idx
  on public.loyalty_transactions (tenant_id, created_at desc, id asc);

create or replace function public.adjust_loyalty_points(p_tenant_id uuid, p_guest_id uuid, p_points integer, p_reason text)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if not public.has_tenant_role(p_tenant_id, array['owner','manager']::public.tenant_role[]) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.guests where id = p_guest_id and tenant_id = p_tenant_id) then raise exception 'guest_not_in_tenant'; end if;
  if p_points = 0 or length(btrim(p_reason)) = 0 then raise exception 'invalid_loyalty_adjustment'; end if;
  insert into public.loyalty_accounts(tenant_id, guest_id, points, lifetime_points)
    values (p_tenant_id, p_guest_id, greatest(p_points,0), greatest(p_points,0))
    on conflict (tenant_id,guest_id) do update set points=loyalty_accounts.points+p_points, lifetime_points=loyalty_accounts.lifetime_points+greatest(p_points,0), updated_at=now();
  if (select points from public.loyalty_accounts where tenant_id=p_tenant_id and guest_id=p_guest_id) < 0 then raise exception 'insufficient_loyalty_points'; end if;
  insert into public.loyalty_transactions(tenant_id,guest_id,points,reason,created_by) values(p_tenant_id,p_guest_id,p_points,btrim(p_reason),auth.uid());
end; $$;

create or replace function public.redeem_loyalty_points(p_tenant_id uuid, p_guest_id uuid, p_points integer, p_reward text)
returns void language plpgsql security invoker set search_path=public as $$
begin
  if not public.has_tenant_role(p_tenant_id, array['owner','manager','waiter']::public.tenant_role[]) then raise exception 'forbidden'; end if;
  if not exists (select 1 from public.guests where id = p_guest_id and tenant_id = p_tenant_id) then raise exception 'guest_not_in_tenant'; end if;
  if p_points <= 0 or length(btrim(p_reward)) = 0 then raise exception 'invalid_loyalty_redemption'; end if;
  update public.loyalty_accounts set points = points - p_points, updated_at = now()
    where tenant_id = p_tenant_id and guest_id = p_guest_id and points >= p_points;
  if not found then raise exception 'insufficient_loyalty_points'; end if;
  insert into public.loyalty_transactions(tenant_id, guest_id, points, reason, created_by) values(p_tenant_id, p_guest_id, -p_points, btrim(p_reward), auth.uid());
end; $$;

revoke all on function public.adjust_loyalty_points(uuid,uuid,integer,text) from public;
grant execute on function public.adjust_loyalty_points(uuid,uuid,integer,text) to authenticated;
revoke all on function public.redeem_loyalty_points(uuid,uuid,integer,text) from public;
grant execute on function public.redeem_loyalty_points(uuid,uuid,integer,text) to authenticated;
