-- Índice de consulta para disponibilidad cuando el flujo público incorpore área.
create index scheduling_blocks_area_period_idx
  on public.scheduling_blocks using gist (tenant_id, venue_id, area_id, period)
  where visible_online;
