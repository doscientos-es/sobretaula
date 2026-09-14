alter table public.tables
  add column if not exists service_block_reason text,
  add column if not exists is_service_blocked boolean not null default false;

alter table public.tables
  add constraint tables_service_block_reason_length
  check (service_block_reason is null or char_length(service_block_reason) <= 300);
