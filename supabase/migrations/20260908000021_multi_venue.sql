-- Una empresa (tenant) opera uno o varios locales. El local pasa a ser la
-- unidad direccionable (slug propio), de asignación de plantilla y de precio.

alter table public.venues
  add column slug text,
  add column is_active boolean not null default true;

-- Backfill determinista desde el nombre, con desempate estable por tenant.
with base as (
  select
    v.id,
    v.tenant_id,
    coalesce(
      nullif(left(btrim(regexp_replace(lower(v.name), '[^a-z0-9]+', '-', 'g'), '-'), 40), ''),
      'local'
    ) as stem
  from public.venues v
), candidate as (
  select
    b.id,
    case when length(b.stem) >= 3 then b.stem else 'local-' || b.stem end as stem,
    row_number() over (partition by b.tenant_id, b.stem order by b.id) as position
  from base b
)
update public.venues v
set slug = case when c.position = 1 then c.stem else c.stem || '-' || c.position end
from candidate c
where v.id = c.id;

alter table public.venues
  alter column slug set not null,
  add constraint venues_slug_format check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$'),
  add constraint venues_tenant_slug_key unique (tenant_id, slug),
  add constraint venues_id_tenant_key unique (id, tenant_id);

alter table public.memberships
  add constraint memberships_id_tenant_key unique (id, tenant_id);

-- Restricción opcional de plantilla a locales concretos. Sin filas para una
-- membresía, el usuario alcanza todos los locales de su empresa.
create table public.membership_venues (
  membership_id uuid not null,
  venue_id uuid not null,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (membership_id, venue_id),
  foreign key (membership_id, tenant_id) references public.memberships (id, tenant_id) on delete cascade,
  foreign key (venue_id, tenant_id) references public.venues (id, tenant_id) on delete cascade
);

create index membership_venues_venue_idx on public.membership_venues (venue_id);
create index membership_venues_tenant_idx on public.membership_venues (tenant_id);

create or replace function public.has_venue_access(p_venue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.venues v
    join public.memberships m on m.tenant_id = v.tenant_id
    where v.id = p_venue_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and (
        not exists (select 1 from public.membership_venues mv where mv.membership_id = m.id)
        or exists (
          select 1 from public.membership_venues mv
          where mv.membership_id = m.id and mv.venue_id = v.id
        )
      )
  );
$$;

revoke execute on function public.has_venue_access(uuid) from public, anon;
grant execute on function public.has_venue_access(uuid) to authenticated;

-- Igual que apply_tenant_rls, añadiendo el filtro de local a cada política.
create or replace function public.apply_venue_scoped_rls(p_table text, p_write_roles public.tenant_role[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_roles text := array_to_string(array(select quote_literal(r) from unnest(p_write_roles) as r), ', ');
  v_read text := 'public.is_operational_member_of(tenant_id) and public.has_venue_access(venue_id)';
  v_check text := format(
    'public.has_operational_tenant_role(tenant_id, array[%s]::public.tenant_role[]) and public.has_venue_access(venue_id)',
    v_roles
  );
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format('alter table public.%I force row level security', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_read', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_insert', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_update', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_delete', p_table);
  execute format('create policy %I on public.%I for select to authenticated using (%s)', p_table || '_read', p_table, v_read);
  execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p_table || '_insert', p_table, v_check);
  execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', p_table || '_update', p_table, v_check, v_check);
  execute format('create policy %I on public.%I for delete to authenticated using (%s)', p_table || '_delete', p_table, v_check);
end;
$$;

revoke execute on function public.apply_venue_scoped_rls(text, public.tenant_role[]) from public, anon, authenticated;

select public.apply_tenant_rls('membership_venues', array['owner', 'manager']::public.tenant_role[]);

select public.apply_venue_scoped_rls('areas', array['owner', 'manager']::public.tenant_role[]);
select public.apply_venue_scoped_rls('tables', array['owner', 'manager']::public.tenant_role[]);
select public.apply_venue_scoped_rls('services', array['owner', 'manager']::public.tenant_role[]);
select public.apply_venue_scoped_rls('closures', array['owner', 'manager']::public.tenant_role[]);
select public.apply_venue_scoped_rls('reservations', array['owner', 'manager', 'host', 'waiter']::public.tenant_role[]);
select public.apply_venue_scoped_rls('holds', array['owner', 'manager', 'host']::public.tenant_role[]);
select public.apply_venue_scoped_rls('waitlist', array['owner', 'manager', 'host']::public.tenant_role[]);
select public.apply_venue_scoped_rls('table_sessions', array['owner', 'manager', 'host', 'waiter']::public.tenant_role[]);

-- El selector solo lista los locales alcanzables. La escritura sigue siendo de
-- empresa: un local nuevo todavía no puede satisfacer has_venue_access().
drop policy venues_read on public.venues;
create policy venues_read on public.venues
  for select to authenticated
  using (public.is_operational_member_of(tenant_id) and public.has_venue_access(id));

-- El precio publicado cubre un local; cada local adicional suma un fijo mensual.
alter table public.plans
  add column extra_venue_monthly_price_cents integer not null default 0
    check (extra_venue_monthly_price_cents >= 0);

update public.plans set extra_venue_monthly_price_cents = 10000 where code = 'standard';

alter table public.platform_billing_invoices
  add column venue_count integer not null default 1 check (venue_count >= 1);

-- Locales facturables del periodo. El mínimo es uno aunque no haya altas.
create or replace function public.tenant_billable_venue_count(p_tenant_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(1, count(*)::integer)
  from public.venues v
  where v.tenant_id = p_tenant_id and v.is_active;
$$;

revoke execute on function public.tenant_billable_venue_count(uuid) from public, anon, authenticated;

-- El alta crea ya el primer local: el precio publicado lo incluye y la app
-- siempre necesita un local al que dirigirse.
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

  insert into public.platform_subscription_price_phases (
    subscription_id, kind, starts_on, ends_on, fixed_amount_cents
  )
  select id, 'fixed_amount', current_date, (current_date + interval '12 months')::date, 9900
  from public.subscriptions where tenant_id = v_tenant_id;

  return query select v_tenant_id, p_tenant_slug;
end;
$$;
