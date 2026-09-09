-- Política comercial inicial de SobreTaula Sala. Esta migración no altera las
-- fases temporales ya concedidas: son compromisos comerciales existentes. Las
-- altas nuevas entran directamente al precio público del plan.

update public.plans
set monthly_price_cents = 14900,
    extra_venue_monthly_price_cents = 7500
where code = 'standard';

-- Founder es una tarifa plana para el primer local, no un 50 % ni una oferta
-- de doce meses. La concesión sigue siendo manual por plataforma y el cupo se
-- protege en base de datos.
update public.platform_discount_codes
set name = 'Founders: 99 EUR/mes netos mientras mantengan la suscripción',
    percent_discount_bps = 3356,
    max_redemptions = 10
where code = 'FOUNDERS';

-- Toda alta nueva es estándar; la tarifa Founder se concede después mediante
-- una fase fixed_amount perpetua de 9.900 céntimos asociada a su redención.
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

  insert into public.venues (tenant_id, name, slug)
  values (v_tenant_id, btrim(p_tenant_name), 'principal');

  insert into public.platform_billing_customers (
    tenant_id, legal_name, tax_id, email, address_line, city, postal_code
  ) values (
    v_tenant_id, btrim(p_legal_name), btrim(p_tax_id), lower(btrim(p_email)),
    btrim(p_address_line), btrim(p_city), btrim(p_postal_code)
  );

  insert into public.subscriptions (tenant_id, plan_id, status)
  values (v_tenant_id, v_plan_id, 'trialing');

  return query select v_tenant_id, p_tenant_slug;
end;
$$;
