alter table public.venues
  add column if not exists service_pacing_target_minutes integer not null default 90;

alter table public.venues
  add constraint venues_service_pacing_target_check
  check (service_pacing_target_minutes between 15 and 360);
