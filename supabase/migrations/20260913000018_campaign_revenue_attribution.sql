create or replace function public.attribute_campaign_payment() returns trigger language plpgsql security definer set search_path = public as $$
declare v_guest_id uuid; v_campaign_id uuid; begin
  select r.guest_id into v_guest_id from public.table_sessions s join public.reservations r on r.id = s.reservation_id where s.id = new.session_id;
  if v_guest_id is null then return new; end if;
  select cr.campaign_id into v_campaign_id from public.guest_campaign_recipients cr join public.guest_campaigns c on c.id = cr.campaign_id where cr.tenant_id = new.tenant_id and cr.guest_id = v_guest_id and cr.consented and cr.status in ('sent','delivered') and c.sent_at is not null and c.sent_at <= new.paid_at and c.sent_at >= new.paid_at - interval '30 days' order by c.sent_at desc limit 1;
  if v_campaign_id is not null then update public.guest_campaign_recipients set attributed_revenue_cents = attributed_revenue_cents + new.amount_cents, converted_at = coalesce(converted_at, new.paid_at) where campaign_id = v_campaign_id and guest_id = v_guest_id; end if;
  return new;
end $$;
drop trigger if exists payments_attribute_campaign on public.payments;
create trigger payments_attribute_campaign after insert on public.payments for each row execute function public.attribute_campaign_payment();
revoke all on function public.attribute_campaign_payment() from public, anon, authenticated;
