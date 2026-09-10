-- Fichaje por terminal: PIN opaco, límite de intentos y eventos inmutables.

alter table public.timekeeping_events
  add column if not exists previous_event_hash text,
  add column if not exists event_hash text;

alter table public.timekeeping_events
  add constraint timekeeping_events_previous_hash_format
  check (previous_event_hash is null or previous_event_hash ~ '^[a-f0-9]{64}$') not valid,
  add constraint timekeeping_events_hash_format
  check (event_hash is null or event_hash ~ '^[a-f0-9]{64}$') not valid;

create unique index if not exists timekeeping_events_event_hash_unique
  on public.timekeeping_events (event_hash)
  where event_hash is not null;

create table public.timekeeping_terminal_attempts (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  terminal_id text not null check (length(btrim(terminal_id)) between 1 and 100),
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 5),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, venue_id, terminal_id)
);

alter table public.timekeeping_terminal_attempts enable row level security;
alter table public.timekeeping_terminal_attempts force row level security;

drop policy if exists timekeeping_events_delete on public.timekeeping_events;
drop policy if exists timekeeping_events_insert on public.timekeeping_events;
drop policy if exists timekeeping_events_read on public.timekeeping_events;
drop policy if exists timekeeping_events_update on public.timekeeping_events;
drop policy if exists timekeeping_pins_delete on public.timekeeping_pins;
drop policy if exists timekeeping_pins_insert on public.timekeeping_pins;
drop policy if exists timekeeping_pins_read on public.timekeeping_pins;
drop policy if exists timekeeping_pins_update on public.timekeeping_pins;

create policy timekeeping_events_read on public.timekeeping_events
  for select to authenticated using (
    employee_id = auth.uid()
    or public.has_operational_tenant_role(
      tenant_id, array['owner', 'manager']::public.tenant_role[]
    )
  );

drop trigger if exists timekeeping_events_append_only on public.timekeeping_events;
create trigger timekeeping_events_append_only
  before update or delete on public.timekeeping_events
  for each row execute function public.forbid_mutation();

create or replace function public.set_my_timekeeping_pin(
  p_tenant_id uuid,
  p_pin text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.uid() is null
    or not exists (
      select 1 from public.memberships
      where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active'
    ) then
    raise exception 'timekeeping_membership_required' using errcode = '42501';
  end if;
  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'timekeeping_pin_invalid' using errcode = '22023';
  end if;

  insert into public.timekeeping_pins (tenant_id, employee_id, pin_hash, updated_at)
  values (p_tenant_id, auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf', 12)), now())
  on conflict (tenant_id, employee_id) do update
    set pin_hash = excluded.pin_hash, updated_at = excluded.updated_at;
  return true;
end;
$$;

create or replace function public.record_timekeeping_event(
  p_tenant_id uuid,
  p_venue_id uuid,
  p_employee_id uuid,
  p_event_type text,
  p_pin text default null,
  p_terminal_id text default null
)
returns table(event_id uuid, event_type text, result text, locked_until timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event_id uuid;
  v_event_hash text;
  v_failed_attempts integer;
  v_last_event text;
  v_locked_until timestamptz;
  v_now timestamptz := now();
  v_pin_hash text;
  v_pin_valid boolean;
  v_previous_hash text;
  v_terminal_id text;
begin
  if auth.uid() is null
    or not exists (
      select 1 from public.memberships
      where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active'
    ) then
    raise exception 'timekeeping_membership_required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.venues
    where id = p_venue_id and tenant_id = p_tenant_id
  ) or not public.has_venue_access(p_venue_id) then
    raise exception 'timekeeping_venue_access_required' using errcode = '42501';
  end if;
  if p_event_type not in ('clock_in', 'break_start', 'break_end', 'clock_out') then
    return query select null::uuid, p_event_type, 'invalid_event', null::timestamptz;
    return;
  end if;
  if not exists (
    select 1
    from public.venues v
    join public.memberships m on m.tenant_id = v.tenant_id
    where v.id = p_venue_id
      and m.user_id = p_employee_id
      and m.status = 'active'
      and (
        not exists (
          select 1 from public.membership_venues mv
          where mv.membership_id = m.id
        )
        or exists (
          select 1 from public.membership_venues mv
          where mv.membership_id = m.id and mv.venue_id = v.id
        )
      )
  ) then
    return query select null::uuid, p_event_type, 'invalid_employee', null::timestamptz;
    return;
  end if;

  if p_pin is null and auth.uid() <> p_employee_id then
    return query select null::uuid, p_event_type, 'invalid_pin', null::timestamptz;
    return;
  end if;
  if p_pin is not null then
    v_terminal_id := nullif(btrim(coalesce(p_terminal_id, '')), '');
    if v_terminal_id is null then
      return query select null::uuid, p_event_type, 'invalid_terminal', null::timestamptz;
      return;
    end if;
    insert into public.timekeeping_terminal_attempts (tenant_id, venue_id, terminal_id)
    values (p_tenant_id, p_venue_id, v_terminal_id)
    on conflict do nothing;
    select failed_attempts, locked_until into v_failed_attempts, v_locked_until
    from public.timekeeping_terminal_attempts
    where tenant_id = p_tenant_id and venue_id = p_venue_id and terminal_id = v_terminal_id
    for update;
    if v_locked_until is not null and v_locked_until > v_now then
      return query select null::uuid, p_event_type, 'locked', v_locked_until;
      return;
    end if;
    update public.timekeeping_terminal_attempts
    set failed_attempts = case when window_started_at < v_now - interval '15 minutes' then 0 else failed_attempts end,
        locked_until = null,
        window_started_at = case when window_started_at < v_now - interval '15 minutes' then v_now else window_started_at end,
        updated_at = v_now
    where tenant_id = p_tenant_id and venue_id = p_venue_id and terminal_id = v_terminal_id
    returning failed_attempts into v_failed_attempts;
    select pin_hash into v_pin_hash from public.timekeeping_pins
    where tenant_id = p_tenant_id and employee_id = p_employee_id;
    v_pin_valid := v_pin_hash is not null and (
      (v_pin_hash like '$2%' and extensions.crypt(p_pin, v_pin_hash) = v_pin_hash)
      or (v_pin_hash not like '$2%' and encode(extensions.digest(p_pin, 'sha256'), 'hex') = v_pin_hash)
    );
    if not v_pin_valid then
      v_failed_attempts := v_failed_attempts + 1;
      v_locked_until := case when v_failed_attempts >= 5 then v_now + interval '15 minutes' else null end;
      update public.timekeeping_terminal_attempts
      set failed_attempts = v_failed_attempts, locked_until = v_locked_until, updated_at = v_now
      where tenant_id = p_tenant_id and venue_id = p_venue_id and terminal_id = v_terminal_id;
      return query select null::uuid, p_event_type, 'invalid_pin', v_locked_until;
      return;
    end if;
    if v_pin_hash not like '$2%' then
      update public.timekeeping_pins
      set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 12)), updated_at = v_now
      where tenant_id = p_tenant_id and employee_id = p_employee_id;
    end if;
    delete from public.timekeeping_terminal_attempts
    where tenant_id = p_tenant_id and venue_id = p_venue_id and terminal_id = v_terminal_id;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || p_venue_id::text || p_employee_id::text, 0));
  select event_type, event_hash into v_last_event, v_previous_hash
  from public.timekeeping_events
  where tenant_id = p_tenant_id and venue_id = p_venue_id and employee_id = p_employee_id
  order by occurred_at desc, id desc limit 1;
  if (v_last_event is null and p_event_type <> 'clock_in')
    or (v_last_event = 'clock_in' and p_event_type not in ('break_start', 'clock_out'))
    or (v_last_event = 'break_start' and p_event_type <> 'break_end')
    or (v_last_event = 'break_end' and p_event_type not in ('break_start', 'clock_out'))
    or (v_last_event = 'clock_out' and p_event_type <> 'clock_in') then
    return query select null::uuid, p_event_type, 'invalid_transition', null::timestamptz;
    return;
  end if;
  v_event_id := gen_random_uuid();
  v_event_hash := encode(extensions.digest(concat_ws('|', v_event_id::text, p_tenant_id::text,
    p_venue_id::text, p_employee_id::text, p_event_type, v_now::text, coalesce(v_terminal_id, ''),
    coalesce(v_previous_hash, '')), 'sha256'), 'hex');
  insert into public.timekeeping_events (
    id, tenant_id, venue_id, employee_id, event_type, occurred_at, terminal_id, previous_event_hash, event_hash
  ) values (
    v_event_id, p_tenant_id, p_venue_id, p_employee_id, p_event_type, v_now, v_terminal_id,
    v_previous_hash, v_event_hash
  );
  return query select v_event_id, p_event_type, 'recorded', null::timestamptz;
end;
$$;

revoke all on function public.set_my_timekeeping_pin(uuid, text) from public;
revoke all on function public.record_timekeeping_event(uuid, uuid, uuid, text, text, text) from public;
grant execute on function public.set_my_timekeeping_pin(uuid, text) to authenticated;
grant execute on function public.record_timekeeping_event(uuid, uuid, uuid, text, text, text) to authenticated;