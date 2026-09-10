alter table public.waitlist
  add column operation_id uuid;

create unique index waitlist_operation_id_idx
  on public.waitlist (operation_id)
  where operation_id is not null;
