alter table public.tables
  add column if not exists is_pending_cleaning boolean not null default false;
