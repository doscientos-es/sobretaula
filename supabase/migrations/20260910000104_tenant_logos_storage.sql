-- Logos de restaurante para el perfil público y las comunicaciones.
-- Bucket público: la app sirve el logo mediante URL pública, sin firma.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tenant_logos',
  'tenant_logos',
  true,
  2 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Escritura acotada por tenant: la ruta guarda tenant_id como prefijo.
create policy tenant_logos_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'tenant_logos'
    and (storage.foldername(name))[1] in (
      select id::text from public.tenants
      where public.has_tenant_role(id, array['owner', 'manager']::public.tenant_role[])
    )
  );

create policy tenant_logos_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'tenant_logos'
    and (storage.foldername(name))[1] in (
      select id::text from public.tenants
      where public.has_tenant_role(id, array['owner', 'manager']::public.tenant_role[])
    )
  );

create policy tenant_logos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'tenant_logos'
    and (storage.foldername(name))[1] in (
      select id::text from public.tenants
      where public.has_tenant_role(id, array['owner', 'manager']::public.tenant_role[])
    )
  );
