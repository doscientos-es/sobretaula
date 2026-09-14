alter table public.menu_items
  add column if not exists kitchen_station text not null default 'general';

alter table public.menu_items
  add constraint menu_items_kitchen_station_check
  check (kitchen_station in ('general', 'hot', 'cold', 'bar', 'dessert'));

alter table public.order_items
  add column if not exists kitchen_station text not null default 'general';

alter table public.order_items
  add constraint order_items_kitchen_station_check
  check (kitchen_station in ('general', 'hot', 'cold', 'bar', 'dessert'));
