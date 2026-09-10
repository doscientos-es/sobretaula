alter table public.ingredients add column if not exists minimum_stock numeric(12,4) not null default 0 check (minimum_stock >= 0);
