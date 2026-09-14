alter table public.cash_registers add column if not exists sales_by_method jsonb not null default '{}'::jsonb;
