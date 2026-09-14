-- Compatibilidad para las políticas posteriores que usan la nomenclatura
-- `is_tenant_member`; mantiene la misma comprobación de pertenencia activa.
create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_member_of(p_tenant_id);
$$;

revoke execute on function public.is_tenant_member(uuid) from anon;
grant execute on function public.is_tenant_member(uuid) to authenticated;