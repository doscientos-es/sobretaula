-- Once the platform fiscal issuer is configured, settle every paid invoice
-- that was kept as a candidate while the settings were missing or disabled.
create or replace function public.reconcile_pending_platform_fiscal_invoices()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice record;
  v_number integer;
begin
  if not new.issuance_enabled then
    return new;
  end if;

  for v_invoice in
    select f.*, b.paid_at, c.tax_id, c.legal_name as customer_legal_name,
      c.email, c.address_line as customer_address_line, c.city as customer_city,
      c.postal_code as customer_postal_code
    from public.platform_fiscal_invoices f
    join public.platform_billing_invoices b on b.id = f.platform_billing_invoice_id
    join public.platform_billing_customers c on c.tenant_id = f.tenant_id
    where f.status = 'pending_review'
      and f.review_reason = 'platform_fiscal_settings_missing_or_disabled'
      and b.status = 'paid'
    order by f.created_at, f.id
    for update of f
  loop
    update public.platform_fiscal_settings
    set next_number = next_number + 1
    where id = true
    returning next_number - 1 into v_number;

    update public.platform_fiscal_invoices
    set status = 'issued',
      review_reason = null,
      series_code = new.series_code,
      number = v_number,
      full_number = new.series_code || '/' || lpad(v_number::text, 6, '0'),
      issued_at = coalesce(issued_at, now()),
      issuer_nif = new.issuer_nif,
      issuer_legal_name = new.legal_name,
      issuer_address_line = new.address_line,
      issuer_city = new.city,
      issuer_postal_code = new.postal_code
    where id = v_invoice.id;

    insert into public.platform_fiscal_outbox (platform_fiscal_invoice_id)
    values (v_invoice.id)
    on conflict (platform_fiscal_invoice_id) do nothing;
  end loop;

  return new;
end;
$$;

revoke execute on function public.reconcile_pending_platform_fiscal_invoices() from public, anon, authenticated;

drop trigger if exists platform_fiscal_settings_reconcile_pending
  on public.platform_fiscal_settings;
create trigger platform_fiscal_settings_reconcile_pending
after insert or update of issuance_enabled, issuer_nif, legal_name, address_line, city, postal_code, series_code
on public.platform_fiscal_settings
for each row execute function public.reconcile_pending_platform_fiscal_invoices();
