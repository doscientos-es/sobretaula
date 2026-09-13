-- Suscripciones Web Push por usuario/dispositivo y avisos internos de nuevas reservas.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null check (length(endpoint) between 1 and 2048),
  p256dh_key text not null check (length(p256dh_key) between 1 and 256),
  auth_key text not null check (length(auth_key) between 1 and 256),
  user_agent text check (user_agent is null or length(user_agent) <= 512),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

create policy push_subscriptions_read on public.push_subscriptions
  for select using (user_id = auth.uid());
create policy push_subscriptions_insert on public.push_subscriptions
  for insert with check (user_id = auth.uid());
create policy push_subscriptions_update on public.push_subscriptions
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_delete on public.push_subscriptions
  for delete using (user_id = auth.uid());

create trigger push_subscriptions_set_updated_at
  before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.reservation_notification_jobs
  add column if not exists recipient_user_id uuid references auth.users (id) on delete set null;

alter table public.reservation_notification_jobs
  drop constraint if exists reservation_notification_jobs_channel_check;
alter table public.reservation_notification_jobs
  add constraint reservation_notification_jobs_channel_check
  check (channel in ('email', 'sms', 'whatsapp', 'push'));

alter table public.reservation_notification_jobs
  drop constraint if exists reservation_notification_jobs_type_check;
alter table public.reservation_notification_jobs
  add constraint reservation_notification_jobs_type_check
  check (type in ('confirmation', 'reminder', 'cancellation', 'change', 'waitlist_offer', 'new_reservation'));

create index reservation_notification_jobs_recipient_idx
  on public.reservation_notification_jobs (recipient_user_id, scheduled_for)
  where channel = 'push' and status = 'pending';

create or replace function public.enqueue_reservation_confirmation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.guest_id is not null and new.status in ('pending', 'confirmed') then
    insert into public.reservation_notification_jobs
      (tenant_id, reservation_id, guest_id, type, channel, locale, scheduled_for, dedupe_key)
    select new.tenant_id, new.id, new.guest_id, 'confirmation', 'email', g.locale, now(),
      new.id::text || ':confirmation'
    from public.guests g
    where g.id = new.guest_id and g.email is not null
    on conflict (tenant_id, dedupe_key) do nothing;

    insert into public.reservation_notification_jobs
      (tenant_id, reservation_id, guest_id, recipient_user_id, type, channel, locale, scheduled_for, dedupe_key)
    select new.tenant_id, new.id, new.guest_id, m.user_id, 'new_reservation', 'push', 'es', now(),
      new.id::text || ':push:' || m.user_id::text
    from public.memberships m
    join public.push_subscriptions ps on ps.user_id = m.user_id
    where m.tenant_id = new.tenant_id and m.status = 'active'
    on conflict (tenant_id, dedupe_key) do nothing;
  end if;

  if tg_op = 'UPDATE' then
    update public.reservation_notification_jobs
    set status = 'cancelled', last_error = 'reservation_changed', updated_at = now()
    where reservation_id = new.id and type = 'reminder' and status in ('pending', 'failed');
  end if;

  if new.guest_id is not null and new.status in ('pending', 'confirmed')
    and new.starts_at > now() then
    insert into public.reservation_notification_jobs
      (tenant_id, reservation_id, guest_id, type, channel, locale, scheduled_for, dedupe_key)
    select new.tenant_id, new.id, new.guest_id, 'reminder', 'email', g.locale,
      greatest(now(), new.starts_at - interval '24 hours'),
      new.id::text || ':reminder:' || extract(epoch from new.starts_at)::bigint::text
    from public.guests g
    where g.id = new.guest_id and g.email is not null
    on conflict (tenant_id, dedupe_key) do update
      set guest_id = excluded.guest_id,
          locale = excluded.locale,
          scheduled_for = excluded.scheduled_for,
          status = 'pending',
          attempts = 0,
          last_error = null,
          sent_at = null,
          updated_at = now()
      where public.reservation_notification_jobs.status = 'cancelled';
  end if;
  return new;
end;
$$;