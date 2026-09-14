-- El historial de propinas es inmutable: conserva cada alta, cambio y cierre
-- con el usuario y el nombre que tenía en el momento de la operación.
create table public.tip_pool_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  event_type text not null check (event_type in ('daily_total_saved', 'daily_total_updated', 'period_closed')),
  entry_id uuid references public.tip_pool_entries(id) on delete restrict,
  period_id uuid references public.tip_pool_periods(id) on delete restrict,
  tip_date date,
  from_date date,
  to_date date,
  total_cents integer not null check (total_cents >= 0),
  note text,
  actor_user_id uuid not null,
  actor_display_name text not null,
  occurred_at timestamptz not null default now()
);

create index tip_pool_audit_events_tenant_venue_occurred_idx
  on public.tip_pool_audit_events(tenant_id, venue_id, occurred_at desc);

alter table public.tip_pool_audit_events enable row level security;
create policy tip_pool_audit_events_read on public.tip_pool_audit_events
  for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

create or replace function public.audit_tip_pool_entry()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor_user_id uuid := coalesce(auth.uid(), new.created_by);
  v_actor_display_name text;
begin
  select display_name into v_actor_display_name from public.profiles where user_id = v_actor_user_id;
  insert into public.tip_pool_audit_events (
    tenant_id, venue_id, event_type, entry_id, tip_date, total_cents, note, actor_user_id, actor_display_name
  ) values (
    new.tenant_id, new.venue_id,
    case when tg_op = 'INSERT' then 'daily_total_saved' else 'daily_total_updated' end,
    new.id, new.tip_date, new.amount_cents, new.note, v_actor_user_id,
    coalesce(v_actor_display_name, 'Usuario sin perfil')
  );
  return new;
end;
$$;

create or replace function public.audit_tip_pool_period()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor_display_name text;
begin
  select display_name into v_actor_display_name from public.profiles where user_id = new.closed_by;
  insert into public.tip_pool_audit_events (
    tenant_id, venue_id, event_type, period_id, from_date, to_date, total_cents, actor_user_id, actor_display_name
  ) values (
    new.tenant_id, new.venue_id, 'period_closed', new.id, new.from_date, new.to_date,
    new.total_cents, new.closed_by, coalesce(v_actor_display_name, 'Usuario sin perfil')
  );
  return new;
end;
$$;

create trigger tip_pool_entries_audit after insert or update on public.tip_pool_entries
  for each row execute function public.audit_tip_pool_entry();
create trigger tip_pool_periods_audit after insert on public.tip_pool_periods
  for each row execute function public.audit_tip_pool_period();

insert into public.tip_pool_audit_events (
  tenant_id, venue_id, event_type, entry_id, tip_date, total_cents, note, actor_user_id, actor_display_name, occurred_at
)
select e.tenant_id, e.venue_id, 'daily_total_saved', e.id, e.tip_date, e.amount_cents, e.note,
  e.created_by, coalesce(p.display_name, 'Usuario sin perfil'), e.created_at
from public.tip_pool_entries e
left join public.profiles p on p.user_id = e.created_by;

insert into public.tip_pool_audit_events (
  tenant_id, venue_id, event_type, period_id, from_date, to_date, total_cents, actor_user_id, actor_display_name, occurred_at
)
select period.tenant_id, period.venue_id, 'period_closed', period.id, period.from_date, period.to_date,
  period.total_cents, period.closed_by, coalesce(p.display_name, 'Usuario sin perfil'), period.closed_at
from public.tip_pool_periods period
left join public.profiles p on p.user_id = period.closed_by;

drop policy if exists tip_pool_entries_delete on public.tip_pool_entries;
drop policy if exists tip_pool_periods_update on public.tip_pool_periods;
drop policy if exists tip_pool_periods_delete on public.tip_pool_periods;

revoke all on function public.audit_tip_pool_entry() from public, anon, authenticated;
revoke all on function public.audit_tip_pool_period() from public, anon, authenticated;