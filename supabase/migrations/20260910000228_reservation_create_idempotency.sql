-- Reintentos de creación no deben generar reservas duplicadas.
create unique index if not exists reservations_tenant_operation_idx
  on public.reservations (tenant_id, last_operation_id)
  where last_operation_id is not null;
