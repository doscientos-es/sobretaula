-- Reafirma la policy necesaria para que el guardado fiscal y su auditoría
-- sean consistentes incluso en proyectos que aplicaron migraciones antiguas
-- antes de la corrección 20260910000062.

drop policy if exists fiscal_settings_audit_insert on public.fiscal_settings_audit;
create policy fiscal_settings_audit_insert on public.fiscal_settings_audit
  for insert to authenticated
  with check (public.has_tenant_role(tenant_id, array['owner']::public.tenant_role[]));
