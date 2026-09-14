alter table public.venues
  add column if not exists service_kitchen_alert_order_count integer not null default 12;

alter table public.venues
  add column if not exists service_kitchen_alert_minutes integer not null default 60;

alter table public.venues
  add constraint venues_service_kitchen_alert_check
  check (service_kitchen_alert_order_count between 1 and 200);

alter table public.venues
  add constraint venues_service_kitchen_alert_minutes_check
  check (service_kitchen_alert_minutes between 1 and 720);
