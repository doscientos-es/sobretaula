alter table public.reservations
  add column last_operation_id uuid;

create index reservations_last_operation_idx
  on public.reservations (last_operation_id)
  where last_operation_id is not null;
