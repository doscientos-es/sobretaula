create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 160),
  tax_id text, phone text, email text, is_active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.delivery_notes (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  venue_id uuid not null references public.venues(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  reference text not null check (char_length(btrim(reference)) between 1 and 120),
  received_on date not null default current_date, status text not null default 'draft' check (status in ('draft','received','cancelled')),
  notes text not null default '', created_by uuid references auth.users(id), received_at timestamptz,
  created_at timestamptz not null default now(), unique (tenant_id, supplier_id, reference)
);
create table public.delivery_note_lines (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants(id) on delete cascade,
  delivery_note_id uuid not null references public.delivery_notes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  quantity numeric(12,4) not null check (quantity > 0), unit_cost_cents numeric(12,4) not null check (unit_cost_cents >= 0),
  unique (delivery_note_id, ingredient_id)
);
create index suppliers_tenant_name_idx on public.suppliers(tenant_id, name);
create index delivery_notes_tenant_venue_date_idx on public.delivery_notes(tenant_id, venue_id, received_on desc);
create index delivery_note_lines_note_idx on public.delivery_note_lines(tenant_id, delivery_note_id);
create trigger suppliers_set_updated_at before update on public.suppliers for each row execute function public.set_updated_at();
select public.apply_tenant_rls('suppliers', array['owner','manager']::public.tenant_role[]);
select public.apply_venue_scoped_rls('delivery_notes', array['owner','manager']::public.tenant_role[]);
select public.apply_tenant_rls('delivery_note_lines', array['owner','manager']::public.tenant_role[]);

create or replace function public.receive_delivery_note(p_delivery_note_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_note public.delivery_notes%rowtype; v_line public.delivery_note_lines%rowtype;
begin
  select * into v_note from public.delivery_notes where id = p_delivery_note_id for update;
  if v_note.id is null then raise exception 'delivery_note_not_found' using errcode = 'P0002'; end if;
  if not public.has_operational_tenant_role(v_note.tenant_id, array['owner','manager']::public.tenant_role[]) or not public.has_venue_access(v_note.venue_id) then raise exception 'delivery_note_forbidden' using errcode = '42501'; end if;
  if v_note.status <> 'draft' then raise exception 'delivery_note_already_processed' using errcode = '23514'; end if;
  for v_line in select * from public.delivery_note_lines where delivery_note_id = v_note.id loop
    insert into public.inventory_movements (tenant_id, venue_id, ingredient_id, kind, quantity, unit_cost_cents, reason, created_by)
    values (v_note.tenant_id, v_note.venue_id, v_line.ingredient_id, 'purchase', v_line.quantity, v_line.unit_cost_cents, 'Albarán ' || v_note.reference, auth.uid());
  end loop;
  update public.delivery_notes set status = 'received', received_at = now() where id = v_note.id;
end; $$;
revoke execute on function public.receive_delivery_note(uuid) from public, anon;
grant execute on function public.receive_delivery_note(uuid) to authenticated;
