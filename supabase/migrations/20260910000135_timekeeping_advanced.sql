-- Control horario avanzado: sincronización personal offline, informes trazables
-- y cambios de centro conservando el histórico de asignaciones.

alter table public.timekeeping_events
  add column if not exists operation_id uuid,
  add column if not exists client_occurred_at timestamptz;

create unique index if not exists timekeeping_events_operation_id_idx
  on public.timekeeping_events (operation_id)
  where operation_id is not null;

create table public.timekeeping_sync_operations (
  operation_id uuid primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (event_type in ('clock_in', 'break_start', 'break_end', 'clock_out')),
  client_occurred_at timestamptz not null,
  event_id uuid references public.timekeeping_events(id) on delete set null,
  result text not null check (result in ('recorded', 'invalid_transition')),
  created_at timestamptz not null default now()
);

create index timekeeping_sync_operations_employee_idx
  on public.timekeeping_sync_operations (tenant_id, employee_id, created_at desc);

alter table public.timekeeping_sync_operations enable row level security;
alter table public.timekeeping_sync_operations force row level security;

create policy timekeeping_sync_operations_read on public.timekeeping_sync_operations
  for select to authenticated using (
    employee_id = auth.uid()
    or public.has_operational_tenant_role(
      tenant_id, array['owner', 'manager']::public.tenant_role[]
    )
  );

create table public.timekeeping_venue_changes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  employee_id uuid not null references auth.users(id) on delete cascade,
  assigned_venue_ids uuid[] not null default '{}'::uuid[],
  effective_from date not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index timekeeping_venue_changes_employee_idx
  on public.timekeeping_venue_changes (tenant_id, employee_id, effective_from desc, created_at desc);

alter table public.timekeeping_venue_changes enable row level security;
alter table public.timekeeping_venue_changes force row level security;

create policy timekeeping_venue_changes_read on public.timekeeping_venue_changes
  for select to authenticated using (
    employee_id = auth.uid()
    or public.has_operational_tenant_role(
      tenant_id, array['owner', 'manager']::public.tenant_role[]
    )
  );

drop trigger if exists timekeeping_venue_changes_append_only on public.timekeeping_venue_changes;
create trigger timekeeping_venue_changes_append_only
  before update or delete on public.timekeeping_venue_changes
  for each row execute function public.forbid_mutation();

-- El portal personal es el único que puede sincronizar fichajes sin PIN. El
-- terminal compartido sigue necesitando red: no se conserva ningún PIN offline.
create or replace function public.record_timekeeping_event_offline(
  p_operation_id uuid,
  p_tenant_id uuid,
  p_venue_id uuid,
  p_event_type text,
  p_client_occurred_at timestamptz
)
returns table(event_id uuid, event_type text, result text, locked_until timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event_id uuid;
  v_event_hash text;
  v_last_event text;
  v_previous_hash text;
  v_now timestamptz := clock_timestamp();
  v_event_at timestamptz := p_client_occurred_at;
  v_existing public.timekeeping_sync_operations%rowtype;
begin
  if auth.uid() is null
    or not exists (
      select 1 from public.memberships
      where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active'
    ) then
    raise exception 'timekeeping_membership_required' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('timekeeping-offline:' || p_operation_id::text, 0));
  select * into v_existing
  from public.timekeeping_sync_operations
  where operation_id = p_operation_id
    and tenant_id = p_tenant_id
    and employee_id = auth.uid();
  if v_existing.operation_id is not null then
    return query select v_existing.event_id, v_existing.event_type, v_existing.result,
      null::timestamptz;
    return;
  end if;
  if p_event_type not in ('clock_in', 'break_start', 'break_end', 'clock_out') then
    raise exception 'timekeeping_event_invalid' using errcode = '22023';
  end if;
  if p_client_occurred_at is null
    or p_client_occurred_at < v_now - interval '14 days'
    or p_client_occurred_at > v_now + interval '5 minutes' then
    raise exception 'timekeeping_client_time_invalid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.venues v
    where v.id = p_venue_id and v.tenant_id = p_tenant_id
  ) or not public.has_venue_access(p_venue_id) then
    raise exception 'timekeeping_venue_access_required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from public.venues v
    join public.memberships m on m.tenant_id = v.tenant_id
    where v.id = p_venue_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (
        not exists (select 1 from public.membership_venues mv where mv.membership_id = m.id)
        or exists (
          select 1 from public.membership_venues mv
          where mv.membership_id = m.id and mv.venue_id = v.id
        )
      )
  ) then
    raise exception 'timekeeping_employee_venue_required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'timekeeping-events:' || p_tenant_id::text || p_venue_id::text || auth.uid()::text, 0
  ));
  select event_type, event_hash into v_last_event, v_previous_hash
  from public.timekeeping_events
  where tenant_id = p_tenant_id and venue_id = p_venue_id and employee_id = auth.uid()
  order by occurred_at desc, id desc limit 1;
  if (v_last_event is null and p_event_type <> 'clock_in')
    or (v_last_event = 'clock_in' and p_event_type not in ('break_start', 'clock_out'))
    or (v_last_event = 'break_start' and p_event_type <> 'break_end')
    or (v_last_event = 'break_end' and p_event_type not in ('break_start', 'clock_out'))
    or (v_last_event = 'clock_out' and p_event_type <> 'clock_in') then
    insert into public.timekeeping_sync_operations (
      operation_id, tenant_id, venue_id, employee_id, event_type,
      client_occurred_at, result
    ) values (
      p_operation_id, p_tenant_id, p_venue_id, auth.uid(), p_event_type,
      p_client_occurred_at, 'invalid_transition'
    );
    return query select null::uuid, p_event_type, 'invalid_transition', null::timestamptz;
    return;
  end if;

  v_event_id := gen_random_uuid();
  v_event_hash := encode(extensions.digest(concat_ws('|', v_event_id::text,
    p_tenant_id::text, p_venue_id::text, auth.uid()::text, p_event_type,
    v_event_at::text, p_operation_id::text, coalesce(v_previous_hash, '')), 'sha256'), 'hex');
  insert into public.timekeeping_events (
    id, tenant_id, venue_id, employee_id, event_type, occurred_at, client_occurred_at,
    operation_id, previous_event_hash, event_hash
  ) values (
    v_event_id, p_tenant_id, p_venue_id, auth.uid(), p_event_type, v_event_at,
    p_client_occurred_at, p_operation_id, v_previous_hash, v_event_hash
  );
  insert into public.timekeeping_sync_operations (
    operation_id, tenant_id, venue_id, employee_id, event_type,
    client_occurred_at, event_id, result
  ) values (
    p_operation_id, p_tenant_id, p_venue_id, auth.uid(), p_event_type,
    p_client_occurred_at, v_event_id, 'recorded'
  );
  return query select v_event_id, p_event_type, 'recorded', null::timestamptz;
end;
$$;

revoke execute on function public.record_timekeeping_event_offline(uuid, uuid, uuid, text, timestamptz)
  from public, anon;
grant execute on function public.record_timekeeping_event_offline(uuid, uuid, uuid, text, timestamptz)
  to authenticated;

create or replace function public.set_timekeeping_employee_venues(
  p_tenant_id uuid,
  p_employee_id uuid,
  p_venue_ids uuid[],
  p_effective_from date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role public.tenant_role;
  v_membership_id uuid;
  v_venue_ids uuid[] := coalesce(p_venue_ids, '{}'::uuid[]);
begin
  select role into v_actor_role from public.memberships
  where tenant_id = p_tenant_id and user_id = auth.uid() and status = 'active';
  if v_actor_role is null or v_actor_role not in ('owner', 'manager') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select id into v_membership_id from public.memberships
  where tenant_id = p_tenant_id and user_id = p_employee_id and status = 'active';
  if v_membership_id is null then
    raise exception 'timekeeping_employee_not_found' using errcode = '22023';
  end if;
  if (select count(*) from unnest(v_venue_ids)) <> cardinality(v_venue_ids) then
    raise exception 'timekeeping_duplicate_venue' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_venue_ids) requested(id)
    where not exists (
      select 1 from public.venues v where v.id = requested.id and v.tenant_id = p_tenant_id and v.is_active
    )
  ) then
    raise exception 'timekeeping_venue_not_found' using errcode = '22023';
  end if;
  delete from public.membership_venues
  where tenant_id = p_tenant_id and membership_id = v_membership_id;
  insert into public.membership_venues (membership_id, venue_id, tenant_id)
  select v_membership_id, requested.id, p_tenant_id
  from unnest(v_venue_ids) requested(id);
  insert into public.timekeeping_venue_changes (
    tenant_id, employee_id, assigned_venue_ids, effective_from, changed_by
  ) values (
    p_tenant_id, p_employee_id, v_venue_ids, p_effective_from, auth.uid()
  );
end;
$$;

revoke execute on function public.set_timekeeping_employee_venues(uuid, uuid, uuid[], date)
  from public, anon;
grant execute on function public.set_timekeeping_employee_venues(uuid, uuid, uuid[], date)
  to authenticated;