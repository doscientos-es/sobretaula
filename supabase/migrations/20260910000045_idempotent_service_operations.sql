-- Permite reintentar operaciones de sala sin abrir dos sesiones para la misma acción.
alter table public.table_sessions
  add column operation_id uuid;

create unique index table_sessions_operation_id_idx
  on public.table_sessions (operation_id)
  where operation_id is not null;
