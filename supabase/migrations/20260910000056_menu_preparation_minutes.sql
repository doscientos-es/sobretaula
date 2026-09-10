alter table public.menu_items
  add column if not exists preparation_minutes integer not null default 15;

alter table public.menu_items
  add constraint menu_items_preparation_minutes_check
  check (preparation_minutes between 1 and 240);

alter table public.order_items
  add column if not exists preparation_minutes integer not null default 15;

alter table public.order_items
  add constraint order_items_preparation_minutes_check
  check (preparation_minutes between 1 and 240);
