-- Composite indexes for the read paths used by the operational terminal and cash reports.
-- Keep the tenant predicate first so RLS-scoped queries can narrow the scan early.
create index if not exists payments_tenant_session_paid_idx
  on public.payments (tenant_id, session_id, paid_at);

create index if not exists orders_tenant_session_idx
  on public.orders (tenant_id, session_id);

create index if not exists cash_registers_tenant_venue_status_idx
  on public.cash_registers (tenant_id, venue_id, status);

create index if not exists cash_reconciliations_tenant_venue_register_idx
  on public.cash_reconciliations (tenant_id, venue_id, register_id, reconciled_at desc);
