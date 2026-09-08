-- Resolución del tenant a partir del slug antes de que exista sesión.
-- Devuelve solo metadatos de marca y exige el slug exacto, así que no permite
-- enumerar tenants ni sustituye a ninguna política RLS.

create or replace function public.tenant_public_by_slug(p_slug text)
returns table (
  id uuid,
  slug text,
  name text,
  status public.tenant_status,
  default_locale public.app_locale,
  timezone text
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.slug, t.name, t.status, t.default_locale, t.timezone
  from public.tenants t
  where t.slug = p_slug;
$$;

revoke execute on function public.tenant_public_by_slug(text) from public;
grant execute on function public.tenant_public_by_slug(text) to anon, authenticated;
