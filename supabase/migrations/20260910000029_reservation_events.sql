-- Historial append-only de reservas. El trigger cubre tanto flujos internos como públicos.

create table public.reservation_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  venue_id uuid not null references public.venues (id) on delete cascade,
  reservation_id uuid references public.reservations (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  actor_kind text not null check (actor_kind in ('staff', 'public', 'system')),
  event_type text not null check (event_type in ('created', 'updated', 'status_changed', 'rescheduled', 'cancelled', 'deleted')),
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index reservation_events_reservation_idx
  on public.reservation_events (reservation_id, created_at desc);
create index reservation_events_tenant_idx
  on public.reservation_events (tenant_id, created_at desc);

alter table public.reservation_events enable row level security;
alter table public.reservation_events force row level security;

create policy reservation_events_read on public.reservation_events
  for select using (public.is_tenant_member(tenant_id));

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
    insert into public.reservation_events (tenant_id, venue_id, reservation_id, actor_user_id, actor_kind, event_type, changes)
      values (old.tenant_id, old.venue_id, old.id, actor, kind, event_name,
        jsonb_build_object('status', old.status, 'starts_at', old.starts_at, 'ends_at', old.ends_at));
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

  insert into public.reservation_events (tenant_id, venue_id, reservation_id, actor_user_id, actor_kind, event_type, changes)
    values (new.tenant_id, new.venue_id, new.id, actor, kind, event_name, diff);
  return new;
end;
$$;

create trigger reservations_record_event
  after insert or update of status, starts_at, ends_at, party_size or delete
  on public.reservations
  for each row execute function public.record_reservation_event();

create or replace function public.prevent_reservation_events_mutation()
returns trigger language plpgsql set search_path = public as $$
begin raise exception 'reservation_events_append_only'; end;
$$;

create trigger reservation_events_append_only
  before update or delete on public.reservation_events
  for each row execute function public.prevent_reservation_events_mutation();
