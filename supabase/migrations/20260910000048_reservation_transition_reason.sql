alter table public.reservations
  add column last_transition_reason text;

alter table public.reservation_events
  add column reason text;

create or replace function public.record_reservation_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  kind text := case when actor is null then 'public' else 'staff' end;
  event_name text;
  diff jsonb := '{}'::jsonb;
begin
  if tg_op = 'INSERT' then
    event_name := 'created';
    diff := jsonb_build_object('status', new.status, 'party_size', new.party_size,
      'starts_at', new.starts_at, 'ends_at', new.ends_at, 'source', new.source);
  elsif tg_op = 'DELETE' then
    event_name := 'deleted';
    insert into public.reservation_events (tenant_id, venue_id, reservation_id, actor_user_id, actor_kind, event_type, changes, reason)
      values (old.tenant_id, old.venue_id, old.id, actor, kind, event_name,
        jsonb_build_object('status', old.status, 'starts_at', old.starts_at, 'ends_at', old.ends_at), old.last_transition_reason);
    return old;
  else
    if new.status is distinct from old.status then
      event_name := case when new.status = 'cancelled' then 'cancelled' else 'status_changed' end;
      diff := diff || jsonb_build_object('from_status', old.status, 'to_status', new.status);
    end if;
    if new.starts_at is distinct from old.starts_at or new.ends_at is distinct from old.ends_at then
      event_name := coalesce(event_name, 'rescheduled');
      diff := diff || jsonb_build_object('from_starts_at', old.starts_at, 'to_starts_at', new.starts_at,
        'from_ends_at', old.ends_at, 'to_ends_at', new.ends_at);
    end if;
    if new.party_size is distinct from old.party_size then
      event_name := coalesce(event_name, 'updated');
      diff := diff || jsonb_build_object('from_party_size', old.party_size, 'to_party_size', new.party_size);
    end if;
    if event_name is null then return new; end if;
  end if;

  insert into public.reservation_events (tenant_id, venue_id, reservation_id, actor_user_id, actor_kind, event_type, changes, reason)
    values (new.tenant_id, new.venue_id, new.id, actor, kind, event_name, diff, new.last_transition_reason);
  return new;
end;
$$;
