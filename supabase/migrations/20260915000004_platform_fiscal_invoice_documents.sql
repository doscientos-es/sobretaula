-- Private, reusable PDF documents for SaaS invoices issued by the platform.
-- Files live under the existing private invoice_documents bucket.

create table public.platform_fiscal_invoice_documents (
  id uuid primary key default gen_random_uuid(),
  platform_fiscal_invoice_id uuid not null unique
    references public.platform_fiscal_invoices (id) on delete restrict,
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  object_path text not null unique,
  content_hash text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

create index platform_fiscal_invoice_documents_tenant_idx
  on public.platform_fiscal_invoice_documents (tenant_id, created_at desc);

alter table public.platform_fiscal_invoice_documents enable row level security;
alter table public.platform_fiscal_invoice_documents force row level security;

create policy platform_fiscal_invoice_documents_read
  on public.platform_fiscal_invoice_documents
  for select to authenticated
  using (
    public.is_platform_owner()
    or public.has_tenant_role(
      tenant_id,
      array['owner', 'manager', 'accountant']::public.tenant_role[]
    )
  );