alter table public.online_orders add column if not exists payment_status text not null default 'pending' check (payment_status in ('pending','authorized','paid','failed','refunded'));
alter table public.online_orders add column if not exists payment_provider text;
alter table public.online_orders add column if not exists payment_reference text;
create unique index if not exists online_orders_payment_reference_idx on public.online_orders(payment_provider, payment_reference) where payment_reference is not null;
