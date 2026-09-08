-- Billing SaaS de SobreTaula. Es independiente de tickets, pagos e impuestos
-- del restaurante: todos los importes son céntimos netos salvo total_cents.

create type public.platform_price_phase_kind as enum ('fixed_amount', 'percent_discount');
create type public.platform_billing_invoice_status as enum ('open', 'paid', 'failed', 'void');
create type public.platform_payment_attempt_status as enum ('created', 'submitted', 'succeeded', 'failed');
create type public.platform_payment_method_status as enum ('pending', 'active', 'expired', 'revoked');

create table public.platform_billing_customers (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  legal_name text not null check (length(btrim(legal_name)) > 0),
  tax_id text not null check (length(btrim(tax_id)) > 0),
  email text not null check (length(btrim(email)) > 0),
  address_line text not null check (length(btrim(address_line)) > 0),
  city text not null check (length(btrim(city)) > 0),
  postal_code text not null check (length(btrim(postal_code)) > 0),
  country_code text not null default 'ES' check (country_code ~ '^[A-Z]{2}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_payment_methods (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null check (provider = 'redsys'),
  -- El identificador recurrible nunca se entrega por RLS ni se guarda en claro.
  provider_reference_ciphertext bytea not null check (octet_length(provider_reference_ciphertext) > 0),
  key_version smallint not null default 1 check (key_version > 0),
  display_label text,
  status public.platform_payment_method_status not null default 'pending',
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index platform_payment_methods_one_default_idx
  on public.platform_payment_methods (tenant_id) where is_default and status = 'active';

create table public.platform_discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and code ~ '^[A-Z0-9-]{3,32}$'),
  name text not null check (length(btrim(name)) > 0),
  percent_discount_bps integer not null check (percent_discount_bps between 1 and 10000),
  max_redemptions integer check (max_redemptions > 0),
  requires_platform_approval boolean not null default false,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);

create table public.platform_discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid not null references public.platform_discount_codes (id) on delete restrict,
  subscription_id uuid not null unique references public.subscriptions (id) on delete cascade,
  approved_by uuid references auth.users (id) on delete set null,
  redeemed_at timestamptz not null default now(),
  unique (discount_code_id, subscription_id)
);

create table public.platform_subscription_price_phases (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  discount_redemption_id uuid unique references public.platform_discount_redemptions (id) on delete restrict,
  kind public.platform_price_phase_kind not null,
  starts_on date not null,
  ends_on date,
  fixed_amount_cents integer,
  percent_discount_bps integer,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on > starts_on),
  check (
    (kind = 'fixed_amount' and fixed_amount_cents is not null and fixed_amount_cents >= 0 and percent_discount_bps is null)
    or (kind = 'percent_discount' and percent_discount_bps is not null and percent_discount_bps between 1 and 10000 and fixed_amount_cents is null)
  ),
  exclude using gist (
    subscription_id with =,
    daterange(starts_on, ends_on, '[)') with &&
  )
);

alter table public.subscriptions
  add column payment_method_id uuid references public.platform_payment_methods (id) on delete set null,
  add column next_payment_on date,
  add column past_due_since date,
  add column grace_ends_on date,
  add column suspended_at timestamptz,
  add column billing_cycle_count integer not null default 0 check (billing_cycle_count >= 0),
  add constraint subscriptions_grace_after_past_due check (
    grace_ends_on is null or (past_due_since is not null and grace_ends_on >= past_due_since)
  );

create index subscriptions_due_idx on public.subscriptions (next_payment_on)
  where status in ('trialing', 'active', 'past_due');

create table public.platform_billing_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  subscription_id uuid not null references public.subscriptions (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status public.platform_billing_invoice_status not null default 'open',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  vat_rate_bps integer not null check (vat_rate_bps between 0 and 10000),
  vat_cents integer not null check (vat_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  due_on date not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subscription_id, period_start),
  check (period_end > period_start),
  check (total_cents = subtotal_cents + vat_cents)
);

create index platform_billing_invoices_due_idx on public.platform_billing_invoices (due_on)
  where status in ('open', 'failed');

create table public.platform_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.platform_billing_invoices (id) on delete restrict,
  payment_method_id uuid references public.platform_payment_methods (id) on delete set null,
  provider text not null check (provider = 'redsys'),
  merchant_order text not null check (merchant_order ~ '^[A-Za-z0-9]{4,12}$'),
  idempotency_key uuid not null unique,
  status public.platform_payment_attempt_status not null default 'created',
  provider_response_code text,
  failure_reason text,
  submitted_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, merchant_order)
);

create index platform_payment_attempts_invoice_idx on public.platform_payment_attempts (invoice_id, created_at desc);

create table public.platform_payment_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider = 'redsys'),
  provider_event_key text not null,
  merchant_order text,
  signature_valid boolean not null,
  response_code text,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, provider_event_key)
);

-- Impide sobrepasar el cupo incluso con altas concurrentes. Founders se entrega
-- manualmente por plataforma, pero su máximo de cinco usos vive en la base.
create or replace function public.validate_platform_discount_redemption()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_code public.platform_discount_codes%rowtype;
  v_redemptions integer;
begin
  select * into v_code
  from public.platform_discount_codes
  where id = new.discount_code_id
  for update;

  if not found or not v_code.is_active or now() < v_code.starts_at
    or (v_code.ends_at is not null and now() >= v_code.ends_at) then
    raise exception 'discount_code_unavailable' using errcode = '23514';
  end if;

  if v_code.max_redemptions is not null then
    select count(*) into v_redemptions
    from public.platform_discount_redemptions
    where discount_code_id = v_code.id;
    if v_redemptions >= v_code.max_redemptions then
      raise exception 'discount_code_limit_reached' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger platform_discount_redemptions_validate
  before insert on public.platform_discount_redemptions
  for each row execute function public.validate_platform_discount_redemption();

revoke execute on function public.validate_platform_discount_redemption() from public, anon, authenticated;

create trigger platform_billing_customers_set_updated_at before update on public.platform_billing_customers
  for each row execute function public.set_updated_at();
create trigger platform_payment_methods_set_updated_at before update on public.platform_payment_methods
  for each row execute function public.set_updated_at();
create trigger platform_billing_invoices_set_updated_at before update on public.platform_billing_invoices
  for each row execute function public.set_updated_at();
create trigger platform_payment_attempts_set_updated_at before update on public.platform_payment_attempts
  for each row execute function public.set_updated_at();

-- Procesa cada notificación confirmada de Redsys de forma idempotente. La
-- llamada llega desde el webhook usando service role, nunca desde el navegador.
create or replace function public.process_platform_redsys_notification(
  p_merchant_order text,
  p_provider_event_key text,
  p_payload_sha256 text,
  p_response_code text,
  p_succeeded boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempt public.platform_payment_attempts%rowtype;
  v_invoice public.platform_billing_invoices%rowtype;
begin
  insert into public.platform_payment_provider_events (
    provider, provider_event_key, merchant_order, signature_valid, response_code, payload_sha256, processed_at
  ) values ('redsys', p_provider_event_key, p_merchant_order, true, p_response_code, p_payload_sha256, now())
  on conflict (provider, provider_event_key) do nothing;
  if not found then return 'duplicate'; end if;

  select * into v_attempt from public.platform_payment_attempts
  where provider = 'redsys' and merchant_order = p_merchant_order for update;
  if not found then return 'unknown_order'; end if;
  if v_attempt.status = 'succeeded' then return 'already_settled'; end if;

  select * into v_invoice from public.platform_billing_invoices
  where id = v_attempt.invoice_id for update;
  if not found then raise exception 'platform_billing_invoice_not_found' using errcode = '23503'; end if;

  if p_succeeded then
    update public.platform_payment_attempts
    set status = 'succeeded', provider_response_code = p_response_code, settled_at = now()
    where id = v_attempt.id;
    update public.platform_billing_invoices set status = 'paid', paid_at = now() where id = v_invoice.id;
    update public.subscriptions
    set status = 'active', current_period_start = v_invoice.period_start,
        current_period_end = v_invoice.period_end, next_payment_on = v_invoice.period_end,
        past_due_since = null, grace_ends_on = null, suspended_at = null,
        billing_cycle_count = billing_cycle_count + 1
    where id = v_invoice.subscription_id;
    update public.tenants set status = 'active'
    where id = v_invoice.tenant_id and status = 'suspended';
    return 'succeeded';
  end if;

  update public.platform_payment_attempts
  set status = 'failed', provider_response_code = p_response_code, failure_reason = 'provider_declined', settled_at = now()
  where id = v_attempt.id;
  update public.platform_billing_invoices set status = 'failed' where id = v_invoice.id and status = 'open';
  update public.subscriptions
  set status = 'past_due', past_due_since = coalesce(past_due_since, v_invoice.due_on),
      grace_ends_on = coalesce(grace_ends_on, v_invoice.due_on + 15)
  where id = v_invoice.subscription_id;
  return 'failed';
end;
$$;

-- El job diario usa esta transición atómica. Nunca borra datos del tenant.
create or replace function public.suspend_overdue_platform_subscriptions(p_as_of date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with overdue as (
    select tenant_id from public.subscriptions
    where status = 'past_due' and grace_ends_on is not null and grace_ends_on <= p_as_of
  ), updated as (
    update public.tenants t set status = 'suspended'
    from overdue o where t.id = o.tenant_id and t.status <> 'suspended'
    returning t.id
  ), subscription_updates as (
    update public.subscriptions s set suspended_at = coalesce(s.suspended_at, now())
    from overdue o where s.tenant_id = o.tenant_id
    returning s.id
  ) select count(*) into v_count from updated;
  return v_count;
end;
$$;

revoke execute on function public.process_platform_redsys_notification(text, text, text, text, boolean) from public, anon, authenticated;
revoke execute on function public.suspend_overdue_platform_subscriptions(date) from public, anon, authenticated;

-- El producto inicial: 300 EUR/mes netos tras los doce primeros meses a 99 EUR.
insert into public.plans (code, name, monthly_price_cents, is_public)
values ('standard', 'SobreTaula', 30000, false)
on conflict (code) do nothing;

-- La concesión de Founders la realiza manualmente plataforma; no se expone como
-- código promocional de autoservicio y está limitada de forma atómica a cinco.
insert into public.platform_discount_codes (
  code, name, percent_discount_bps, max_redemptions, requires_platform_approval, is_active
)
values ('FOUNDERS', 'Founders: 50% perpetuo tras el primer año', 5000, 5, true, true)
on conflict (code) do nothing;

alter table public.platform_billing_customers enable row level security;
alter table public.platform_billing_customers force row level security;
alter table public.platform_payment_methods enable row level security;
alter table public.platform_payment_methods force row level security;
alter table public.platform_discount_codes enable row level security;
alter table public.platform_discount_codes force row level security;
alter table public.platform_discount_redemptions enable row level security;
alter table public.platform_discount_redemptions force row level security;
alter table public.platform_subscription_price_phases enable row level security;
alter table public.platform_subscription_price_phases force row level security;
alter table public.platform_billing_invoices enable row level security;
alter table public.platform_billing_invoices force row level security;
alter table public.platform_payment_attempts enable row level security;
alter table public.platform_payment_attempts force row level security;
alter table public.platform_payment_provider_events enable row level security;
alter table public.platform_payment_provider_events force row level security;

create policy platform_billing_customers_read on public.platform_billing_customers
  for select to authenticated using (public.has_tenant_role(tenant_id, array['owner']::public.tenant_role[]) or public.is_platform_member());
create policy platform_billing_customers_insert on public.platform_billing_customers
  for insert to authenticated with check (public.has_tenant_role(tenant_id, array['owner']::public.tenant_role[]));
create policy platform_billing_customers_update on public.platform_billing_customers
  for update to authenticated using (public.has_tenant_role(tenant_id, array['owner']::public.tenant_role[])) with check (public.has_tenant_role(tenant_id, array['owner']::public.tenant_role[]));

create policy platform_discount_codes_platform_read on public.platform_discount_codes
  for select to authenticated using (public.is_platform_member());
create policy platform_discount_codes_platform_write on public.platform_discount_codes
  for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
create policy platform_discount_redemptions_read on public.platform_discount_redemptions
  for select to authenticated using (
    public.is_platform_member() or exists (
      select 1 from public.subscriptions s where s.id = subscription_id and public.has_tenant_role(s.tenant_id, array['owner']::public.tenant_role[])
    )
  );
create policy platform_subscription_price_phases_read on public.platform_subscription_price_phases
  for select to authenticated using (
    public.is_platform_member() or exists (
      select 1 from public.subscriptions s where s.id = subscription_id and public.has_tenant_role(s.tenant_id, array['owner']::public.tenant_role[])
    )
  );
create policy platform_billing_invoices_read on public.platform_billing_invoices
  for select to authenticated using (public.has_tenant_role(tenant_id, array['owner']::public.tenant_role[]) or public.is_platform_member());
create policy platform_payment_attempts_read on public.platform_payment_attempts
  for select to authenticated using (
    public.is_platform_member() or exists (
      select 1 from public.platform_billing_invoices i where i.id = invoice_id and public.has_tenant_role(i.tenant_id, array['owner']::public.tenant_role[])
    )
  );

-- Una suspensión bloquea tanto llamadas directas a PostgREST como server fns.
create or replace function public.is_operational_member_of(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.user_id = auth.uid()
      and m.tenant_id = p_tenant_id
      and m.status = 'active'
      and t.status in ('trial', 'active')
  );
$$;

create or replace function public.has_operational_tenant_role(p_tenant_id uuid, p_roles public.tenant_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    join public.tenants t on t.id = m.tenant_id
    where m.user_id = auth.uid()
      and m.tenant_id = p_tenant_id
      and m.status = 'active'
      and m.role = any (p_roles)
      and t.status in ('trial', 'active')
  );
$$;

revoke execute on function public.is_operational_member_of(uuid) from public, anon;
revoke execute on function public.has_operational_tenant_role(uuid, public.tenant_role[]) from public, anon;
grant execute on function public.is_operational_member_of(uuid) to authenticated;
grant execute on function public.has_operational_tenant_role(uuid, public.tenant_role[]) to authenticated;

create or replace function public.apply_tenant_rls(p_table text, p_write_roles public.tenant_role[])
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_roles text := array_to_string(array(select quote_literal(r) from unnest(p_write_roles) as r), ', ');
  v_check text := format('public.has_operational_tenant_role(tenant_id, array[%s]::public.tenant_role[])', v_roles);
begin
  execute format('alter table public.%I enable row level security', p_table);
  execute format('alter table public.%I force row level security', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_read', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_insert', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_update', p_table);
  execute format('drop policy if exists %I on public.%I', p_table || '_delete', p_table);
  execute format('create policy %I on public.%I for select to authenticated using (public.is_operational_member_of(tenant_id))', p_table || '_read', p_table);
  execute format('create policy %I on public.%I for insert to authenticated with check (%s)', p_table || '_insert', p_table, v_check);
  execute format('create policy %I on public.%I for update to authenticated using (%s) with check (%s)', p_table || '_update', p_table, v_check, v_check);
  execute format('create policy %I on public.%I for delete to authenticated using (%s)', p_table || '_delete', p_table, v_check);
end;
$$;

select public.apply_tenant_rls('venues', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('areas', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('floor_plan_versions', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('plan_elements', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('tables', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('table_placements', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('table_group_presets', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('services', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('availability_rules', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('closures', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('guests', array['owner', 'manager', 'host']::public.tenant_role[]);
select public.apply_tenant_rls('reservations', array['owner', 'manager', 'host', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('reservation_tables', array['owner', 'manager', 'host', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('holds', array['owner', 'manager', 'host']::public.tenant_role[]);
select public.apply_tenant_rls('waitlist', array['owner', 'manager', 'host']::public.tenant_role[]);
select public.apply_tenant_rls('table_sessions', array['owner', 'manager', 'host', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('menu_categories', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('menu_items', array['owner', 'manager']::public.tenant_role[]);
select public.apply_tenant_rls('orders', array['owner', 'manager', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('order_items', array['owner', 'manager', 'waiter']::public.tenant_role[]);
select public.apply_tenant_rls('payments', array['owner', 'manager', 'waiter']::public.tenant_role[]);

-- Configuración operativa que conserva políticas propias: tampoco puede
-- modificarse por PostgREST cuando el tenant está suspendido.
drop policy tenants_update on public.tenants;
create policy tenants_update on public.tenants
  for update to authenticated
  using (public.has_operational_tenant_role(id, array['owner']::public.tenant_role[]) or public.is_platform_owner())
  with check (public.has_operational_tenant_role(id, array['owner']::public.tenant_role[]) or public.is_platform_owner());

drop policy memberships_insert on public.memberships;
drop policy memberships_update on public.memberships;
drop policy memberships_delete on public.memberships;
create policy memberships_insert on public.memberships
  for insert to authenticated with check (public.has_operational_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
create policy memberships_update on public.memberships
  for update to authenticated using (public.has_operational_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[])) with check (public.has_operational_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
create policy memberships_delete on public.memberships
  for delete to authenticated using (public.has_operational_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

drop policy invitations_read on public.invitations;
drop policy invitations_insert on public.invitations;
drop policy invitations_delete on public.invitations;
create policy invitations_read on public.invitations
  for select to authenticated using (public.has_operational_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
create policy invitations_insert on public.invitations
  for insert to authenticated with check (public.has_operational_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));
create policy invitations_delete on public.invitations
  for delete to authenticated using (public.has_operational_tenant_role(tenant_id, array['owner', 'manager']::public.tenant_role[]));

-- La reserva fiscal tampoco puede avanzar cuando el SaaS está suspendido.
create or replace function public.reserve_invoice_number(p_series_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_number integer;
  v_tenant uuid;
begin
  select tenant_id into v_tenant from public.invoice_series where id = p_series_id for update;
  if v_tenant is null then raise exception 'invoice_series_not_found' using errcode = '22023'; end if;
  if not public.has_operational_tenant_role(v_tenant, array['owner', 'manager', 'accountant']::public.tenant_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.invoice_series set next_number = next_number + 1 where id = p_series_id returning next_number - 1 into v_number;
  return v_number;
end;
$$;