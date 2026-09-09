-- Documentos fiscales (PDF de factura) en storage privado.
-- create-once: la aplicación sube y el cliente sólo descarga mediante URL firmada.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'invoice_documents',
  'invoice_documents',
  false,
  10 * 1024 * 1024,
  array['application/pdf']
)
on conflict (id) do nothing;

-- Lectura/escritura acotada por tenant: la ruta guarda tenant_id como prefijo.
create policy invoice_documents_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'invoice_documents'
    and (storage.foldername(name))[1] in (
      select id::text from public.tenants
      where public.has_tenant_role(id, array['owner', 'manager', 'accountant']::public.tenant_role[])
    )
  );

create policy invoice_documents_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'invoice_documents'
    and (storage.foldername(name))[1] in (
      select id::text from public.tenants
      where public.has_tenant_role(id, array['owner', 'manager']::public.tenant_role[])
    )
  );

create policy invoice_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'invoice_documents'
    and (storage.foldername(name))[1] in (
      select id::text from public.tenants
      where public.has_tenant_role(id, array['owner', 'manager']::public.tenant_role[])
    )
  );
