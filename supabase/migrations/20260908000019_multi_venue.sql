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
