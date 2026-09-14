-- El identificador de una terminal web es controlable por el cliente. El límite
-- complementario por empleado evita eludirlo rotando ese identificador.

create table public.timekeeping_pin_attempts (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade,
  failed_attempts integer not null default 0 check (failed_attempts between 0 and 5),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, venue_id, employee_id)
);

alter table public.timekeeping_pin_attempts enable row level security;
alter table public.timekeeping_pin_attempts force row level security;

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
  v_employee_failed_attempts integer;
  v_last_event text;
  v_locked_until timestamptz;
  v_employee_locked_until timestamptz;
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
    insert into public.timekeeping_pin_attempts (tenant_id, venue_id, employee_id)
    values (p_tenant_id, p_venue_id, p_employee_id)
    on conflict do nothing;
    select failed_attempts, locked_until into v_failed_attempts, v_locked_until
    from public.timekeeping_terminal_attempts
    where tenant_id = p_tenant_id and venue_id = p_venue_id and terminal_id = v_terminal_id
    for update;
    select failed_attempts, locked_until into v_employee_failed_attempts, v_employee_locked_until
    from public.timekeeping_pin_attempts
    where tenant_id = p_tenant_id and venue_id = p_venue_id and employee_id = p_employee_id
    for update;
    if (v_locked_until is not null and v_locked_until > v_now)
      or (v_employee_locked_until is not null and v_employee_locked_until > v_now) then
      return query select null::uuid, p_event_type, 'locked',
        case when coalesce(v_locked_until, '-infinity'::timestamptz) >= coalesce(v_employee_locked_until, '-infinity'::timestamptz)
          then v_locked_until else v_employee_locked_until end;
      return;
    end if;
    update public.timekeeping_terminal_attempts
    set failed_attempts = case when window_started_at < v_now - interval '15 minutes' then 0 else failed_attempts end,
        locked_until = null,
        window_started_at = case when window_started_at < v_now - interval '15 minutes' then v_now else window_started_at end,
        updated_at = v_now
    where tenant_id = p_tenant_id and venue_id = p_venue_id and terminal_id = v_terminal_id
    returning failed_attempts into v_failed_attempts;
    update public.timekeeping_pin_attempts
    set failed_attempts = case when window_started_at < v_now - interval '15 minutes' then 0 else failed_attempts end,
        locked_until = null,
        window_started_at = case when window_started_at < v_now - interval '15 minutes' then v_now else window_started_at end,
        updated_at = v_now
    where tenant_id = p_tenant_id and venue_id = p_venue_id and employee_id = p_employee_id
    returning failed_attempts into v_employee_failed_attempts;
    select pin_hash into v_pin_hash from public.timekeeping_pins
    where tenant_id = p_tenant_id and employee_id = p_employee_id;
    v_pin_valid := v_pin_hash is not null and (
      (v_pin_hash like '$2%' and extensions.crypt(p_pin, v_pin_hash) = v_pin_hash)
      or (v_pin_hash not like '$2%' and encode(extensions.digest(p_pin, 'sha256'), 'hex') = v_pin_hash)
    );
    if not v_pin_valid then
      v_failed_attempts := v_failed_attempts + 1;
      v_employee_failed_attempts := v_employee_failed_attempts + 1;
      v_locked_until := case when v_failed_attempts >= 5 then v_now + interval '15 minutes' else null end;
      v_employee_locked_until := case when v_employee_failed_attempts >= 5 then v_now + interval '15 minutes' else null end;
      update public.timekeeping_terminal_attempts
      set failed_attempts = v_failed_attempts, locked_until = v_locked_until, updated_at = v_now
      where tenant_id = p_tenant_id and venue_id = p_venue_id and terminal_id = v_terminal_id;
      update public.timekeeping_pin_attempts
      set failed_attempts = v_employee_failed_attempts, locked_until = v_employee_locked_until, updated_at = v_now
      where tenant_id = p_tenant_id and venue_id = p_venue_id and employee_id = p_employee_id;
      return query select null::uuid, p_event_type, 'invalid_pin',
        case when coalesce(v_locked_until, '-infinity'::timestamptz) >= coalesce(v_employee_locked_until, '-infinity'::timestamptz)
          then v_locked_until else v_employee_locked_until end;
      return;
    end if;
    if v_pin_hash not like '$2%' then
      update public.timekeeping_pins
      set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf', 12)), updated_at = v_now
      where tenant_id = p_tenant_id and employee_id = p_employee_id;
    end if;
    delete from public.timekeeping_terminal_attempts
    where tenant_id = p_tenant_id and venue_id = p_venue_id and terminal_id = v_terminal_id;
    delete from public.timekeeping_pin_attempts
    where tenant_id = p_tenant_id and venue_id = p_venue_id and employee_id = p_employee_id;
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