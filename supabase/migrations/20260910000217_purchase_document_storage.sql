insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('purchase_documents', 'purchase_documents', false, 15 * 1024 * 1024, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy purchase_documents_read on storage.objects for select to authenticated
using (bucket_id = 'purchase_documents' and (storage.foldername(name))[1] in (
  select id::text from public.tenants where public.has_tenant_role(id, array['owner','manager','accountant']::public.tenant_role[])
));

create policy purchase_documents_write on storage.objects for insert to authenticated
with check (bucket_id = 'purchase_documents' and (storage.foldername(name))[1] in (
  select id::text from public.tenants where public.has_tenant_role(id, array['owner','manager']::public.tenant_role[])
));

create policy purchase_documents_delete on storage.objects for delete to authenticated
using (bucket_id = 'purchase_documents' and (storage.foldername(name))[1] in (
  select id::text from public.tenants where public.has_tenant_role(id, array['owner','manager']::public.tenant_role[])
));
