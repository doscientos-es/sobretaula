alter table public.delivery_notes add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null;
create index if not exists delivery_notes_purchase_order_idx on public.delivery_notes(tenant_id, purchase_order_id);
create or replace function public.receive_delivery_note(p_delivery_note_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_note public.delivery_notes%rowtype; v_line public.delivery_note_lines%rowtype; v_order public.purchase_orders%rowtype;
begin
  select * into v_note from public.delivery_notes where id = p_delivery_note_id for update;
  if v_note.id is null then raise exception 'delivery_note_not_found' using errcode = 'P0002'; end if;
  if not public.has_operational_tenant_role(v_note.tenant_id, array['owner','manager']::public.tenant_role[]) or not public.has_venue_access(v_note.venue_id) then raise exception 'delivery_note_forbidden' using errcode = '42501'; end if;
  if v_note.status <> 'draft' then raise exception 'delivery_note_already_processed' using errcode = '23514'; end if;
  if v_note.purchase_order_id is not null then
    select * into v_order from public.purchase_orders where id = v_note.purchase_order_id for update;
    if v_order.id is null or v_order.tenant_id <> v_note.tenant_id or v_order.venue_id <> v_note.venue_id or v_order.supplier_id <> v_note.supplier_id then raise exception 'delivery_note_purchase_order_mismatch' using errcode = '23514'; end if;
    if v_order.status not in ('approved','sent') then raise exception 'delivery_note_purchase_order_not_receivable' using errcode = '23514'; end if;
  end if;
  for v_line in select * from public.delivery_note_lines where delivery_note_id = v_note.id loop
    insert into public.inventory_movements (tenant_id, venue_id, ingredient_id, kind, quantity, unit_cost_cents, reason, created_by)
    values (v_note.tenant_id, v_note.venue_id, v_line.ingredient_id, 'purchase', v_line.quantity, v_line.unit_cost_cents, 'Albarán ' || v_note.reference, auth.uid());
  end loop;
  update public.delivery_notes set status = 'received', received_at = now() where id = v_note.id;
  if v_note.purchase_order_id is not null then update public.purchase_orders set status = 'received', updated_at = now() where id = v_note.purchase_order_id; end if;
end; $$;
