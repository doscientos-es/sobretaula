-- Estado operativo de cada línea para cocina, barra y sala.
alter table public.order_items
  add column if not exists status text not null default 'pending';

alter table public.order_items
  drop constraint if exists order_items_status_check;

alter table public.order_items
  add constraint order_items_status_check
  check (status in ('pending', 'preparing', 'ready', 'served', 'cancelled'));

create index if not exists order_items_status_idx
  on public.order_items (tenant_id, status, created_at);
