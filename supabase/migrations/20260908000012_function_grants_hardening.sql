-- Supabase concede EXECUTE por defecto a anon y authenticated en public.
-- Revocar de PUBLIC no basta: hay que revocar el grant explícito de anon.

revoke execute on function public.is_platform_member() from anon;
revoke execute on function public.is_platform_owner() from anon;
revoke execute on function public.is_member_of(uuid) from anon;
revoke execute on function public.has_tenant_role(uuid, public.tenant_role[]) from anon;
revoke execute on function public.reserve_invoice_number(uuid) from anon;

-- Utilidad de migración: nunca expuesta por la API.
revoke execute on function public.apply_tenant_rls(text, public.tenant_role[]) from anon, authenticated;

-- Funciones de trigger: no son endpoints.
revoke execute on function public.set_updated_at() from anon, authenticated;
revoke execute on function public.forbid_mutation() from anon, authenticated;
revoke execute on function public.sync_reservation_tables() from anon, authenticated;
