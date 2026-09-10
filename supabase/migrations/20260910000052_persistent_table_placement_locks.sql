alter table public.table_placements
  add column if not exists is_locked boolean not null default false;

comment on column public.table_placements.is_locked is
  'Prevents accidental movement while editing a floor-plan version.';
