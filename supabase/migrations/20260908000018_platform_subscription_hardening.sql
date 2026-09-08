-- Ajustes posteriores al advisor: índices de FK y denegación explícita en
-- tablas que sólo manipulan workers/webhooks con service role.

create index platform_billing_invoices_tenant_idx on public.platform_billing_invoices (tenant_id);
create index platform_discount_redemptions_approved_by_idx on public.platform_discount_redemptions (approved_by);
create index platform_payment_attempts_method_idx on public.platform_payment_attempts (payment_method_id);
create index subscriptions_payment_method_idx on public.subscriptions (payment_method_id);

create policy platform_payment_methods_service_only on public.platform_payment_methods
  for all to authenticated using (false) with check (false);
create policy platform_payment_provider_events_service_only on public.platform_payment_provider_events
  for all to authenticated using (false) with check (false);

drop policy platform_discount_codes_platform_write on public.platform_discount_codes;
create policy platform_discount_codes_platform_insert on public.platform_discount_codes
  for insert to authenticated with check (public.is_platform_owner());
create policy platform_discount_codes_platform_update on public.platform_discount_codes
  for update to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
create policy platform_discount_codes_platform_delete on public.platform_discount_codes
  for delete to authenticated using (public.is_platform_owner());

-- Helper heredado de la infraestructura: no es una API de la aplicación.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;