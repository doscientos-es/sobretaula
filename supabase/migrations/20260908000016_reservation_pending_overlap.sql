-- Una reserva pendiente ya ocupa una mesa durante el proceso de confirmación.
-- La exclusión es la última línea de defensa ante dos solicitudes concurrentes.

alter table public.reservation_tables
  drop constraint if exists reservation_tables_no_overlap;

alter table public.reservation_tables
  add constraint reservation_tables_no_overlap exclude using gist (
    tenant_id with =,
    table_id with =,
    period with &&
  ) where (status in ('pending', 'confirmed', 'seated'));