-- El trigger de auth invoca esta función sin que deba ser un RPC público.
revoke execute on function public.create_profile_for_auth_user() from public, anon, authenticated;

-- Cubren las FKs compuestas y las comprobaciones de alcance por tenant.
create index membership_venues_membership_tenant_idx
  on public.membership_venues (membership_id, tenant_id);
create index membership_venues_venue_tenant_idx
  on public.membership_venues (venue_id, tenant_id);