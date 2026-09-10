-- Recordatorios email idempotentes 24 h antes de cada reserva futura.
-- Las reservas canceladas, completadas, no-show o ya iniciadas nunca se reclaman.

create or replace function public.enqueue_reservation_confirmation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  reminder_key text;
begin
  if tg_op = 'UPDATE' then
    update public.reservation_notification_jobs
    set status = 'cancelled', last_error = 'reservation_changed', updated_at = now()
    where reservation_id = new.id and type = 'reminder' and status in ('pending', 'failed');
  end if;

  if tg_op = 'INSERT' and new.guest_id is not null and new.status in ('pending', 'confirmed') then
    insert into public.reservation_notification_jobs
      (tenant_id, reservation_id, guest_id, type, channel, locale, scheduled_for, dedupe_key)
    select new.tenant_id, new.id, new.guest_id, 'confirmation', 'email', g.locale, now(),
      new.id::text || ':confirmation'
    from public.guests g
    where g.id = new.guest_id and g.email is not null
    on conflict (tenant_id, dedupe_key) do nothing;
  end if;

  if new.guest_id is not null and new.status in ('pending', 'confirmed')
    and new.starts_at > now() then
    reminder_key := new.id::text || ':reminder:' || extract(epoch from new.starts_at)::bigint::text;
    insert into public.reservation_notification_jobs
      (tenant_id, reservation_id, guest_id, type, channel, locale, scheduled_for, dedupe_key)
    select new.tenant_id, new.id, new.guest_id, 'reminder', 'email', g.locale,
      greatest(now(), new.starts_at - interval '24 hours'), reminder_key
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

drop trigger if exists reservations_enqueue_confirmation on public.reservations;
create trigger reservations_enqueue_confirmation
  after insert or update of starts_at, status, guest_id on public.reservations
  for each row execute function public.enqueue_reservation_confirmation();

create or replace function public.claim_reservation_notification_jobs(p_limit integer default 25)
returns setof public.reservation_notification_jobs
language plpgsql security definer set search_path = public as $$
begin
  update public.reservation_notification_jobs j
  set status = 'cancelled', last_error = 'reservation_not_eligible', updated_at = now()
  from public.reservations r
  where j.reservation_id = r.id and j.type = 'reminder'
    and j.status in ('pending', 'failed')
    and (r.status not in ('pending', 'confirmed') or r.starts_at <= now());

  return query
    with due as (
      select j.id
      from public.reservation_notification_jobs j
      left join public.reservations r on r.id = j.reservation_id
      where j.status = 'pending' and j.scheduled_for <= now() and j.attempts < 5
        and (j.type <> 'reminder' or (
          r.id is not null and r.status in ('pending', 'confirmed')
          and r.starts_at > now() and r.starts_at <= now() + interval '24 hours'
        ))
      order by j.scheduled_for, j.created_at
      for update of j skip locked limit greatest(1, least(p_limit, 100))
    )
    update public.reservation_notification_jobs j
    set status = 'processing', attempts = j.attempts + 1, updated_at = now()
    from due where j.id = due.id
    returning j.*;
end;
$$;

create or replace function public.cancel_reservation_notification_job(
  p_id uuid, p_reason text default null
)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  update public.reservation_notification_jobs
  set status = 'cancelled', last_error = left(coalesce(p_reason, 'not_eligible'), 500), updated_at = now()
  where id = p_id and status = 'processing';
  return found;
end;
$$;
revoke execute on function public.cancel_reservation_notification_job(uuid, text)
  from public, anon, authenticated;
grant execute on function public.cancel_reservation_notification_job(uuid, text) to service_role;