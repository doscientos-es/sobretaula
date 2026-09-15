-- Tenant billing administrators can inspect the payment state shown beside
-- the platform fiscal invoice history. Writes remain unavailable to them.

drop policy if exists platform_billing_invoices_read on public.platform_billing_invoices;
create policy platform_billing_invoices_read on public.platform_billing_invoices
  for select to authenticated using (
    public.has_tenant_role(
      tenant_id,
      array['owner', 'manager', 'accountant']::public.tenant_role[]
    )
    or public.is_platform_member()
  );