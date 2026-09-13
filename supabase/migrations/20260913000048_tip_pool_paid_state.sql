alter table public.tip_pool_entries
  add column paid_at timestamptz,
  add column paid_period_id uuid references public.tip_pool_periods(id) on delete restrict;

create index tip_pool_entries_paid_idx
  on public.tip_pool_entries(tenant_id, venue_id, paid_at);
