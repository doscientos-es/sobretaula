create index if not exists reservation_notification_jobs_tenant_created_idx
  on public.reservation_notification_jobs (tenant_id, created_at desc, id asc);

drop policy if exists reservation_notification_jobs_read on public.reservation_notification_jobs;
create policy reservation_notification_jobs_read on public.reservation_notification_jobs
  for select to authenticated using (public.is_tenant_member(tenant_id));

drop policy if exists reservation_notification_jobs_write on public.reservation_notification_jobs;
create policy reservation_notification_jobs_write on public.reservation_notification_jobs
  for insert to authenticated with check (public.is_tenant_member(tenant_id));

grant select, insert on public.reservation_notification_jobs to authenticated;
