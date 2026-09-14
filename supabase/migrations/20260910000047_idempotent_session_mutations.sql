-- Marca el último comando aplicado sobre una sesión para que los reintentos
-- del cliente no vuelvan a ejecutar efectos secundarios.
alter table public.table_sessions
  add column last_operation_id uuid;

create index table_sessions_last_operation_idx
  on public.table_sessions (last_operation_id)
  where last_operation_id is not null;
