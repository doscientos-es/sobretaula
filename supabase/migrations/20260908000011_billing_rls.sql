-- RLS fiscal. El cliente lee; escribe sólo el servidor (service role) salvo
-- la configuración fiscal, que gestiona la propiedad del restaurante.

alter table public.tenant_fiscal_settings enable row level security;
alter table public.tenant_fiscal_settings force row level security;
alter table public.fiscal_settings_audit enable row level security;
alter table public.fiscal_settings_audit force row level security;
alter table public.invoice_series enable row level security;
alter table public.invoice_series force row level security;
alter table public.invoices enable row level security;
alter table public.invoices force row level security;
alter table public.invoice_documents enable row level security;
alter table public.invoice_documents force row level security;
alter table public.verifactu_ledger enable row level security;
alter table public.verifactu_ledger force row level security;
alter table public.verifactu_outbox enable row level security;
alter table public.verifactu_outbox force row level security;

create policy tenant_fiscal_settings_read on public.tenant_fiscal_settings
  for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager', 'accountant']::public.tenant_role[]));
create policy tenant_fiscal_settings_write on public.tenant_fiscal_settings
  for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner']::public.tenant_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner']::public.tenant_role[]));

create policy fiscal_settings_audit_read on public.fiscal_settings_audit
  for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'accountant']::public.tenant_role[]));

create policy invoice_series_read on public.invoice_series
  for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager', 'accountant']::public.tenant_role[]));
create policy invoice_series_write on public.invoice_series
  for all to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]))
  with check (public.has_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

-- Las facturas no se editan desde el cliente: se emiten en servidor.
create policy invoices_read on public.invoices
  for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager', 'accountant', 'waiter']::public.tenant_role[]));

create policy invoice_documents_read on public.invoice_documents
  for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'manager', 'accountant']::public.tenant_role[]));

create policy verifactu_ledger_read on public.verifactu_ledger
  for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'accountant']::public.tenant_role[]));

create policy verifactu_outbox_read on public.verifactu_outbox
  for select to authenticated
  using (public.has_tenant_role(tenant_id, array['owner', 'accountant']::public.tenant_role[]));
