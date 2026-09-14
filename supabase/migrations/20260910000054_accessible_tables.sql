alter table public.tables
  add column if not exists is_accessible boolean not null default false;
