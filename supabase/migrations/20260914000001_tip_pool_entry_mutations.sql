-- Permite corregir o retirar cierres diarios pendientes, conservando auditoría.
alter table public.tip_pool_audit_events
  drop constraint if exists tip_pool_audit_events_event_type_check;
alter table public.tip_pool_audit_events
  add constraint tip_pool_audit_events_event_type_check
  check (event_type in ('daily_total_saved', 'daily_total_updated', 'daily_total_deleted', 'period_closed'));

create policy tip_pool_entries_delete on public.tip_pool_entries
  for delete to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]) and paid_at is null);

create or replace function public.audit_tip_pool_entry()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_entry_id uuid;
  v_tenant_id uuid;
  v_venue_id uuid;
  v_tip_date date;
  v_amount_cents integer;
  v_note text;
  v_actor_user_id uuid;
  v_actor_display_name text;
begin
  if tg_op = 'DELETE' then
    v_entry_id := old.id;
    v_tenant_id := old.tenant_id;
    v_venue_id := old.venue_id;
    v_tip_date := old.tip_date;
    v_amount_cents := old.amount_cents;
    v_note := old.note;
    v_actor_user_id := coalesce(auth.uid(), old.created_by);
  else
    v_entry_id := new.id;
    v_tenant_id := new.tenant_id;
    v_venue_id := new.venue_id;
    v_tip_date := new.tip_date;
    v_amount_cents := new.amount_cents;
    v_note := new.note;
    v_actor_user_id := coalesce(auth.uid(), new.created_by);
  end if;
  select display_name into v_actor_display_name from public.profiles where user_id = v_actor_user_id;
  insert into public.tip_pool_audit_events (
    tenant_id, venue_id, event_type, entry_id, tip_date, total_cents, note, actor_user_id, actor_display_name
  ) values (
    v_tenant_id, v_venue_id,
    case when tg_op = 'INSERT' then 'daily_total_saved'
         when tg_op = 'UPDATE' then 'daily_total_updated'
         else 'daily_total_deleted' end,
    v_entry_id, v_tip_date, v_amount_cents, v_note, v_actor_user_id,
    coalesce(v_actor_display_name, 'Usuario sin perfil')
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists tip_pool_entries_audit on public.tip_pool_entries;
create trigger tip_pool_entries_audit after insert or update or delete on public.tip_pool_entries
  for each row execute function public.audit_tip_pool_entry();
