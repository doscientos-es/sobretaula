-- Expose the restaurant timezone with the public management lookup so clients
-- always see the reservation in the venue's local time.
drop function if exists public.public_reservation_by_token(text);

create or replace function public.public_reservation_by_token(p_token_hash text)
returns table (reservation_id uuid, tenant_name text, venue_name text, timezone text, party_size integer,
  starts_at timestamptz, ends_at timestamptz, status public.reservation_status)
language sql stable security definer set search_path = ''
as $$
  select r.id, t.name, v.name, t.timezone, r.party_size, r.starts_at, r.ends_at, r.status
  from public.reservations r join public.tenants t on t.id = r.tenant_id
  join public.venues v on v.id = r.venue_id
  where r.public_token_hash = p_token_hash and r.public_token_expires_at > now();
$$;

revoke execute on function public.public_reservation_by_token(text) from public, authenticated;
grant execute on function public.public_reservation_by_token(text) to anon;
