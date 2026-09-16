alter table public.tables
  add column if not exists normal_seats integer;

update public.tables
set normal_seats = greatest(min_seats, least(max_seats, 4))
where normal_seats is null;

alter table public.tables
  alter column normal_seats set default 4,
  alter column normal_seats set not null;

alter table public.tables
  add constraint tables_normal_seats_range
  check (min_seats <= normal_seats and normal_seats <= max_seats);
