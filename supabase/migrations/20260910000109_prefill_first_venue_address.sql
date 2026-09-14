-- El local "principal" se crea junto al tenant, con los mismos datos de
-- dirección y huso horario ya introducidos en el alta: la mayoría de clientes
-- solo tiene un restaurante, así que evitamos pedirle la misma información
-- dos veces y dejamos el local listo con dirección y huso horario correctos.

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

  insert into public.venues (tenant_id, name, slug, address_line, city, postal_code, timezone)
  values (
    v_tenant_id, btrim(p_tenant_name), 'principal',
    btrim(p_address_line), btrim(p_city), btrim(p_postal_code), p_timezone
  );

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

-- Mismo criterio para el alta interna de tenants desde la consola de plataforma.
create or replace function public.provision_platform_tenant(
  p_tenant_name text,
  p_tenant_slug text,
  p_default_locale public.app_locale,
  p_timezone text,
  p_legal_name text,
  p_tax_id text,
  p_email text,
  p_address_line text,
  p_city text,
  p_postal_code text,
  p_owner_email text,
  p_owner_token_hash text
)
returns table (tenant_id uuid, tenant_slug text, owner_invitation_created boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_plan_id uuid;
  v_owner_user_id uuid;
  v_owner_email text := lower(btrim(p_owner_email));
begin
  if not public.is_platform_owner()
    or coalesce(length(btrim(p_tenant_name)), 0) not between 1 and 120
    or coalesce(length(btrim(p_legal_name)), 0) not between 1 and 200
    or coalesce(length(btrim(p_tax_id)), 0) not between 1 and 32
    or coalesce(length(btrim(p_email)), 0) not between 1 and 254
    or coalesce(length(btrim(p_address_line)), 0) not between 1 and 200
    or coalesce(length(btrim(p_city)), 0) not between 1 and 100
    or coalesce(length(btrim(p_postal_code)), 0) not between 1 and 20
    or coalesce(v_owner_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$', true)
    or coalesce(p_tenant_slug !~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$', true)
    or coalesce(p_owner_token_hash !~ '^[a-f0-9]{64}$', true)
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_platform_tenant_provisioning' using errcode = '22023';
  end if;

  select id into v_plan_id from public.plans where code = 'standard';
  if v_plan_id is null then raise exception 'standard_plan_not_configured' using errcode = '23503'; end if;

  insert into public.tenants (name, slug, status, default_locale, timezone)
  values (btrim(p_tenant_name), p_tenant_slug, 'setup_pending', p_default_locale, p_timezone)
  returning id into v_tenant_id;
  insert into public.venues (tenant_id, name, slug, address_line, city, postal_code, timezone)
  values (
    v_tenant_id, btrim(p_tenant_name), 'principal',
    btrim(p_address_line), btrim(p_city), btrim(p_postal_code), p_timezone
  );
  insert into public.platform_billing_customers (
    tenant_id, legal_name, tax_id, email, address_line, city, postal_code
  ) values (
    v_tenant_id, btrim(p_legal_name), btrim(p_tax_id), lower(btrim(p_email)),
    btrim(p_address_line), btrim(p_city), btrim(p_postal_code)
  );
  insert into public.subscriptions (tenant_id, plan_id, status)
  values (v_tenant_id, v_plan_id, 'trialing');

  select user_id into v_owner_user_id from public.profiles where email = v_owner_email;
  if v_owner_user_id is not null then
    insert into public.memberships (tenant_id, user_id, role, status)
    values (v_tenant_id, v_owner_user_id, 'owner', 'active');
  else
    insert into public.invitations (tenant_id, email, role, token_hash, expires_at)
    values (v_tenant_id, v_owner_email, 'owner', p_owner_token_hash, now() + interval '7 days');
  end if;

  insert into public.platform_audit_log (actor_user_id, action, target_type, target_id, metadata)
  values (
    auth.uid(), 'tenant_created', 'tenant', v_tenant_id,
    jsonb_build_object('owner_email', v_owner_email, 'owner_invited', v_owner_user_id is null)
  );
  return query select v_tenant_id, p_tenant_slug, v_owner_user_id is null;
end;
$$;
