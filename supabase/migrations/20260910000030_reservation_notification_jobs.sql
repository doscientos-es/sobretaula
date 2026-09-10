-- Outbox de comunicaciones: persistir primero, enviar después desde un worker.

create table public.reservation_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  reservation_id uuid references public.reservations (id) on delete set null,
  guest_id uuid references public.guests (id) on delete set null,
  type text not null check (type in ('confirmation', 'reminder', 'cancellation', 'change', 'waitlist_offer')),
  channel text not null check (channel in ('email', 'sms', 'whatsapp')),
  locale public.app_locale not null default 'es',
  scheduled_for timestamptz not null,
  dedupe_key text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts smallint not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, dedupe_key)
);

create index reservation_notification_jobs_due_idx
  on public.reservation_notification_jobs (scheduled_for)
  where status = 'pending';

alter table public.reservation_notification_jobs enable row level security;
alter table public.reservation_notification_jobs force row level security;

create policy reservation_notification_jobs_read on public.reservation_notification_jobs
  for select using (public.is_tenant_member(tenant_id));

create policy reservation_notification_jobs_write on public.reservation_notification_jobs
  for insert with check (public.is_tenant_member(tenant_id));

create trigger reservation_notification_jobs_set_updated_at
  before update on public.reservation_notification_jobs
  for each row execute function public.set_updated_at();

create or replace function public.enqueue_reservation_confirmation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.guest_id is not null and new.status in ('pending', 'confirmed') then
    insert into public.reservation_notification_jobs
      (tenant_id, reservation_id, guest_id, type, channel, locale, scheduled_for, dedupe_key)
    select new.tenant_id, new.id, new.guest_id, 'confirmation',
      case when g.email is not null then 'email' else 'sms' end, g.locale, now(),
      new.id::text || ':confirmation'
    from public.guests g where g.id = new.guest_id and (g.email is not null or g.phone is not null)
    on conflict (tenant_id, dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

create trigger reservations_enqueue_confirmation
  after insert on public.reservations
  for each row execute function public.enqueue_reservation_confirmation();

-- Reclamación atómica para un worker (Edge Function/Cron). SKIP LOCKED permite
-- ejecutar varios workers sin duplicar el mismo trabajo.
create or replace function public.claim_reservation_notification_jobs(p_limit integer default 25)
returns setof public.reservation_notification_jobs
language plpgsql security definer set search_path = public as $$
begin
  return query
    with due as (
      select id from public.reservation_notification_jobs
      where status = 'pending' and scheduled_for <= now() and attempts < 5
      order by scheduled_for, created_at
      for update skip locked limit greatest(1, least(p_limit, 100))
    )
    update public.reservation_notification_jobs j
    set status = 'processing', attempts = j.attempts + 1, updated_at = now()
    from due where j.id = due.id
    returning j.*;
end;
$$;
revoke execute on function public.claim_reservation_notification_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_reservation_notification_jobs(integer) to service_role;

create or replace function public.finish_reservation_notification_job(
  p_id uuid, p_succeeded boolean, p_error text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.reservation_notification_jobs
  set status = case when p_succeeded then 'sent' else case when attempts >= 5 then 'failed' else 'pending' end end,
      last_error = case when p_succeeded then null else left(coalesce(p_error, 'delivery_failed'), 500) end,
      sent_at = case when p_succeeded then now() else sent_at end,
      scheduled_for = case when p_succeeded or attempts >= 5 then scheduled_for else now() + (power(2, attempts) * interval '1 minute') end,
      updated_at = now()
  where id = p_id and status = 'processing';
end;
$$;
revoke execute on function public.finish_reservation_notification_job(uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.finish_reservation_notification_job(uuid, boolean, text) to service_role;

create or replace function public.requeue_reservation_notification_job(p_id uuid, p_tenant_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.is_tenant_member(p_tenant_id) then raise exception 'forbidden'; end if;
  update public.reservation_notification_jobs
  set status = 'pending', attempts = 0, last_error = null, scheduled_for = now(), updated_at = now()
  where id = p_id and tenant_id = p_tenant_id and status = 'failed';
  return found;
end;
$$;
grant execute on function public.requeue_reservation_notification_job(uuid, uuid) to authenticated;
