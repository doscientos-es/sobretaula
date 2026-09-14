create or replace function public.merge_guests(
  p_tenant_id uuid,
  p_source_guest_id uuid,
  p_target_guest_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
begin
  if p_source_guest_id = p_target_guest_id then
    raise exception 'guest_merge_same_guest';
  end if;
  if not public.is_tenant_member(p_tenant_id) then
    raise exception 'guest_merge_forbidden';
  end if;
  if not exists (select 1 from public.guests where id = p_source_guest_id and tenant_id = p_tenant_id)
     or not exists (select 1 from public.guests where id = p_target_guest_id and tenant_id = p_tenant_id) then
    raise exception 'guest_merge_not_found';
  end if;
  update public.reservations set guest_id = p_target_guest_id
    where tenant_id = p_tenant_id and guest_id = p_source_guest_id;
  insert into public.guest_notes (tenant_id, guest_id, category, body, author_user_id)
    select tenant_id, p_target_guest_id, category, body, author_user_id
    from public.guest_notes where tenant_id = p_tenant_id and guest_id = p_source_guest_id;
  insert into public.guest_tag_assignments (tenant_id, guest_id, tag_id, assigned_by)
    select tenant_id, p_target_guest_id, tag_id, assigned_by
    from public.guest_tag_assignments s
    where tenant_id = p_tenant_id and guest_id = p_source_guest_id
      and not exists (select 1 from public.guest_tag_assignments t
        where t.tenant_id = p_tenant_id and t.guest_id = p_target_guest_id and t.tag_id = s.tag_id);
  delete from public.guest_tag_assignments where tenant_id = p_tenant_id and guest_id = p_source_guest_id;
  delete from public.guest_notes where tenant_id = p_tenant_id and guest_id = p_source_guest_id;
  delete from public.guests where tenant_id = p_tenant_id and id = p_source_guest_id;
  return p_target_guest_id;
end;
$$;
