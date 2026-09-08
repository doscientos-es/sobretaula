-- Alta atómica y autocontenida: el usuario autenticado sólo puede crear un
-- tenant que le pertenece, con el plan estándar y sin acceso operativo aún.
create or replace function public.provision_tenant_onboarding(
  p_tenant_name text,
  p_tenant_slug text,
  p_default_locale public.app_locale,
  p_timezone text,
  p_legal_name text,
  p_tax_id text,
  p_email text,
  p_address_line text,
  p_city text,
  p_postal_code text
)
returns table (tenant_id uuid, tenant_slug text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_plan_id uuid;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;

  if length(btrim(p_tenant_name)) = 0
    or length(btrim(p_legal_name)) = 0
    or length(btrim(p_tax_id)) = 0
    or length(btrim(p_email)) = 0
    or length(btrim(p_address_line)) = 0
    or length(btrim(p_city)) = 0
    or length(btrim(p_postal_code)) = 0 then
    raise exception 'invalid_onboarding_data' using errcode = '22023';
  end if;

  if p_tenant_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$' then
    raise exception 'invalid_tenant_slug' using errcode = '22023';
  end if;

  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_timezone' using errcode = '22023';
  end if;

  select id into v_plan_id from public.plans where code = 'standard';
  if v_plan_id is null then
    raise exception 'standard_plan_not_configured' using errcode = '23503';
  end if;

  insert into public.tenants (name, slug, status, default_locale, timezone)
  values (btrim(p_tenant_name), p_tenant_slug, 'setup_pending', p_default_locale, p_timezone)
  returning id into v_tenant_id;

  insert into public.memberships (tenant_id, user_id, role, status)
  values (v_tenant_id, auth.uid(), 'owner', 'active');

  insert into public.platform_billing_customers (
    tenant_id, legal_name, tax_id, email, address_line, city, postal_code
  ) values (
    v_tenant_id, btrim(p_legal_name), btrim(p_tax_id), lower(btrim(p_email)),
    btrim(p_address_line), btrim(p_city), btrim(p_postal_code)
  );

  insert into public.subscriptions (tenant_id, plan_id, status)
  values (v_tenant_id, v_plan_id, 'trialing');

  insert into public.platform_subscription_price_phases (
    subscription_id, kind, starts_on, ends_on, fixed_amount_cents
  )
  select id, 'fixed_amount', current_date, (current_date + interval '12 months')::date, 9900
  from public.subscriptions where tenant_id = v_tenant_id;

  return query select v_tenant_id, p_tenant_slug;
end;
$$;

revoke execute on function public.provision_tenant_onboarding(
  text, text, public.app_locale, text, text, text, text, text, text, text
) from public, anon;
grant execute on function public.provision_tenant_onboarding(
  text, text, public.app_locale, text, text, text, text, text, text, text
) to authenticated;