-- Un pago inicial confirmado debe activar también el tenant creado durante el alta.
-- Sin esta transición la suscripción queda activa, pero el tenant permanece
-- setup_pending y la aplicación sigue mostrando el onboarding.
create or replace function public.process_platform_redsys_notification(
  p_merchant_order text,
  p_provider_event_key text,
  p_payload_sha256 text,
  p_response_code text,
  p_succeeded boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.platform_payment_attempts%rowtype;
  v_invoice public.platform_billing_invoices%rowtype;
begin
  insert into public.platform_payment_provider_events (
    provider, provider_event_key, merchant_order, signature_valid, response_code, payload_sha256, processed_at
  ) values ('redsys', p_provider_event_key, p_merchant_order, true, p_response_code, p_payload_sha256, now())
  on conflict (provider, provider_event_key) do nothing;
  if not found then return 'duplicate'; end if;

  select * into v_attempt from public.platform_payment_attempts
  where provider = 'redsys' and merchant_order = p_merchant_order for update;
  if not found then return 'unknown_order'; end if;
  if v_attempt.status = 'succeeded' then return 'already_settled'; end if;

  select * into v_invoice from public.platform_billing_invoices
  where id = v_attempt.invoice_id for update;
  if not found then raise exception 'platform_billing_invoice_not_found' using errcode = '23503'; end if;

  if p_succeeded then
    update public.platform_payment_attempts
    set status = 'succeeded', provider_response_code = p_response_code, settled_at = now()
    where id = v_attempt.id;
    update public.platform_billing_invoices set status = 'paid', paid_at = now() where id = v_invoice.id;
    update public.subscriptions
    set status = 'active', current_period_start = v_invoice.period_start,
        current_period_end = v_invoice.period_end, next_payment_on = v_invoice.period_end,
        past_due_since = null, grace_ends_on = null, suspended_at = null,
        billing_cycle_count = billing_cycle_count + 1
    where id = v_invoice.subscription_id;
    update public.tenants set status = 'active'
    where id = v_invoice.tenant_id and status in ('setup_pending', 'trial', 'suspended');
    return 'succeeded';
  end if;

  update public.platform_payment_attempts
  set status = 'failed', provider_response_code = p_response_code, failure_reason = 'provider_declined', settled_at = now()
  where id = v_attempt.id;
  update public.platform_billing_invoices set status = 'failed' where id = v_invoice.id and status = 'open';
  update public.subscriptions
  set status = 'past_due', past_due_since = coalesce(past_due_since, v_invoice.due_on),
      grace_ends_on = coalesce(grace_ends_on, v_invoice.due_on + 15)
  where id = v_invoice.subscription_id;
  return 'failed';
end;
$$;

revoke execute on function public.process_platform_redsys_notification(text, text, text, text, boolean) from public, anon, authenticated;