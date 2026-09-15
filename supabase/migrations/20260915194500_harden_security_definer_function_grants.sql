-- Estas RPC requieren un usuario autenticado; PUBLIC también concede EXECUTE a anon.
revoke execute on function public.create_waitlist_offer_token(uuid, uuid) from public, anon;
grant execute on function public.create_waitlist_offer_token(uuid, uuid) to authenticated;

revoke execute on function public.is_tenant_member(uuid) from public, anon;
grant execute on function public.is_tenant_member(uuid) to authenticated;

revoke execute on function public.offer_waitlist_entry(uuid, uuid, integer) from public, anon;
grant execute on function public.offer_waitlist_entry(uuid, uuid, integer) to authenticated;

revoke execute on function public.record_timekeeping_event(uuid, uuid, uuid, text, text, text)
  from public, anon;
grant execute on function public.record_timekeeping_event(uuid, uuid, uuid, text, text, text)
  to authenticated;

revoke execute on function public.requeue_reservation_notification_job(uuid, uuid)
  from public, anon;
grant execute on function public.requeue_reservation_notification_job(uuid, uuid) to authenticated;

revoke execute on function public.set_my_timekeeping_pin(uuid, text) from public, anon;
grant execute on function public.set_my_timekeeping_pin(uuid, text) to authenticated;

-- Funciones de trigger: no son endpoints RPC y no necesitan EXECUTE de roles de API.
revoke execute on function public.enqueue_reservation_confirmation()
  from public, anon, authenticated;
revoke execute on function public.guard_reservation_scheduling_blocks()
  from public, anon, authenticated;
revoke execute on function public.record_reservation_event()
  from public, anon, authenticated;