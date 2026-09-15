-- Dashboard and reservations workspace filter by tenant, venue, status and time.
create index if not exists reservations_tenant_venue_status_starts_idx
  on public.reservations (tenant_id, venue_id, status, starts_at);
