-- `fiscal_settings_audit` sólo tenía política de lectura: el INSERT que hace
-- `saveFiscalSettings` (guardado de identidad fiscal) se rechazaba por RLS
-- (force row level security sin política de escritura), lo que hacía fallar
-- el guardado de datos fiscales con un error genérico. Mismo criterio que
-- `tenant_fiscal_settings_insert` (sólo el propietario del tenant).

create policy fiscal_settings_audit_insert on public.fiscal_settings_audit
  for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['owner']::public.tenant_role[]));
