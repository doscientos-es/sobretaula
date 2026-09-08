-- Facturas fiscales de SobreTaula al restaurante. Son un circuito distinto de
-- las facturas que el restaurante emite a sus clientes y de los cobros Redsys.

create type public.platform_fiscal_invoice_status as enum ('pending_review', 'issued', 'registered');
create type public.platform_fiscal_outbox_status as enum (
  'pending', 'processing', 'accepted', 'retryable_error', 'needs_review'
);

create table public.platform_fiscal_settings (
  id boolean primary key default true check (id),
  issuer_nif text not null check (issuer_nif ~ '^[A-Z0-9]{9}$'),
  legal_name text not null check (length(btrim(legal_name)) > 0),
  address_line text not null check (length(btrim(address_line)) > 0),
  city text not null check (length(btrim(city)) > 0),
  postal_code text not null check (length(btrim(postal_code)) > 0),
  country_code text not null default 'ES' check (country_code ~ '^[A-Z]{2}$'),
  environment public.verifactu_env not null default 'test',
  series_code text not null default 'ST' check (series_code ~ '^[A-Z0-9-]{1,12}$'),
  next_number integer not null default 1 check (next_number > 0),
  issuance_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_fiscal_invoices (
  id uuid primary key default gen_random_uuid(),
  platform_billing_invoice_id uuid not null unique references public.platform_billing_invoices (id) on delete restrict,
  tenant_id uuid not null references public.tenants (id) on delete restrict,
  period_start date not null,
  period_end date not null,
  status public.platform_fiscal_invoice_status not null default 'pending_review',
  series_code text,
  number integer check (number is null or number > 0),
  full_number text,
  issued_at timestamptz,
  issuer_nif text,
  issuer_legal_name text,
  issuer_address_line text,
  issuer_city text,
  issuer_postal_code text,
  customer_nif text not null,
  customer_name text not null,
  customer_email text not null,
  customer_address_line text not null,
  customer_city text not null,
  customer_postal_code text not null,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  vat_rate_bps integer not null check (vat_rate_bps between 0 and 10000),
  vat_cents integer not null check (vat_cents >= 0),
  total_cents integer not null check (total_cents = subtotal_cents + vat_cents),
  lines jsonb not null,
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (period_end > period_start),
  check (
    (status = 'pending_review' and review_reason is not null)
    or (status in ('issued', 'registered') and series_code is not null and number is not null
      and full_number is not null and issued_at is not null and issuer_nif is not null)
  )
);

create unique index platform_fiscal_invoices_series_number_idx
  on public.platform_fiscal_invoices (series_code, number) where number is not null;
create index platform_fiscal_invoices_tenant_idx
  on public.platform_fiscal_invoices (tenant_id, period_end desc);

create table public.platform_fiscal_outbox (
  id uuid primary key default gen_random_uuid(),
  platform_fiscal_invoice_id uuid not null unique references public.platform_fiscal_invoices (id) on delete restrict,
  status public.platform_fiscal_outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_result jsonb,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index platform_fiscal_outbox_due_idx on public.platform_fiscal_outbox (next_attempt_at)
  where status in ('pending', 'retryable_error');

create trigger platform_fiscal_settings_set_updated_at before update on public.platform_fiscal_settings
  for each row execute function public.set_updated_at();
create trigger platform_fiscal_invoices_set_updated_at before update on public.platform_fiscal_invoices
  for each row execute function public.set_updated_at();
create trigger platform_fiscal_outbox_set_updated_at before update on public.platform_fiscal_outbox
  for each row execute function public.set_updated_at();

-- Materializa el candidato fiscal de un recibo ya creado. Si faltan los datos
-- del emisor, conserva el candidato en revisión; nunca se pierde el periodo.
create or replace function public.create_platform_fiscal_invoice(
  p_platform_billing_invoice_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_billing public.platform_billing_invoices%rowtype;
  v_customer public.platform_billing_customers%rowtype;
  v_settings public.platform_fiscal_settings%rowtype;
  v_existing_id uuid;
  v_invoice_id uuid;
  v_number integer;
begin
  select id into v_existing_id from public.platform_fiscal_invoices
  where platform_billing_invoice_id = p_platform_billing_invoice_id;
  if v_existing_id is not null then return v_existing_id; end if;

  select * into v_billing from public.platform_billing_invoices
  where id = p_platform_billing_invoice_id;
  if not found then raise exception 'platform_billing_invoice_not_found' using errcode = '22023'; end if;

  select * into v_customer from public.platform_billing_customers
  where tenant_id = v_billing.tenant_id;
  if not found then raise exception 'platform_billing_customer_not_found' using errcode = '23503'; end if;

  select * into v_settings from public.platform_fiscal_settings
  where id and issuance_enabled for update;
  if not found then
    insert into public.platform_fiscal_invoices (
      platform_billing_invoice_id, tenant_id, period_start, period_end, status, review_reason,
      customer_nif, customer_name, customer_email, customer_address_line, customer_city, customer_postal_code,
      subtotal_cents, vat_rate_bps, vat_cents, total_cents, lines
    ) values (
      v_billing.id, v_billing.tenant_id, v_billing.period_start, v_billing.period_end, 'pending_review',
      'platform_fiscal_settings_missing_or_disabled', v_customer.tax_id, v_customer.legal_name,
      v_customer.email, v_customer.address_line, v_customer.city, v_customer.postal_code,
      v_billing.subtotal_cents, v_billing.vat_rate_bps, v_billing.vat_cents, v_billing.total_cents,
      jsonb_build_array(jsonb_build_object('description', 'Suscripción SobreTaula', 'quantity', 1,
        'subtotal_cents', v_billing.subtotal_cents, 'vat_rate_bps', v_billing.vat_rate_bps))
    ) returning id into v_invoice_id;
    return v_invoice_id;
  end if;

  update public.platform_fiscal_settings set next_number = next_number + 1 where id
  returning next_number - 1 into v_number;
  insert into public.platform_fiscal_invoices (
    platform_billing_invoice_id, tenant_id, period_start, period_end, status, series_code, number, full_number,
    issued_at, issuer_nif, issuer_legal_name, issuer_address_line, issuer_city, issuer_postal_code,
    customer_nif, customer_name, customer_email, customer_address_line, customer_city, customer_postal_code,
    subtotal_cents, vat_rate_bps, vat_cents, total_cents, lines
  ) values (
    v_billing.id, v_billing.tenant_id, v_billing.period_start, v_billing.period_end, 'issued',
    v_settings.series_code, v_number, v_settings.series_code || '/' || lpad(v_number::text, 6, '0'), now(),
    v_settings.issuer_nif, v_settings.legal_name, v_settings.address_line, v_settings.city, v_settings.postal_code,
    v_customer.tax_id, v_customer.legal_name, v_customer.email, v_customer.address_line, v_customer.city,
    v_customer.postal_code, v_billing.subtotal_cents, v_billing.vat_rate_bps, v_billing.vat_cents,
    v_billing.total_cents, jsonb_build_array(jsonb_build_object('description', 'Suscripción SobreTaula',
      'quantity', 1, 'subtotal_cents', v_billing.subtotal_cents, 'vat_rate_bps', v_billing.vat_rate_bps))
  ) returning id into v_invoice_id;
  insert into public.platform_fiscal_outbox (platform_fiscal_invoice_id) values (v_invoice_id);
  return v_invoice_id;
end;
$$;

-- Se ejecuta el día 1 para cerrar el mes anterior. Es recuperable: si el cron
-- se retrasa, la unicidad (suscripción, periodo) impide facturas duplicadas.
create or replace function public.generate_platform_month_end_invoices(
  p_period_end date default date_trunc('month', current_date)::date
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subscription record;
  v_billing_invoice_id uuid;
  v_period_start date := (p_period_end - interval '1 month')::date;
  v_subtotal_cents integer;
  v_venue_count integer;
  v_count integer := 0;
begin
  if p_period_end > current_date or p_period_end <> date_trunc('month', p_period_end)::date then
    raise exception 'invalid_platform_billing_period_end' using errcode = '22023';
  end if;

  for v_subscription in
    select s.id as subscription_id, s.tenant_id, p.monthly_price_cents, p.extra_venue_monthly_price_cents,
      phase.kind as phase_kind, phase.fixed_amount_cents, phase.percent_discount_bps
    from public.subscriptions s
    join public.plans p on p.id = s.plan_id
    left join lateral (
      select kind, fixed_amount_cents, percent_discount_bps
      from public.platform_subscription_price_phases phase
      where phase.subscription_id = s.id and phase.starts_on <= v_period_start
        and (phase.ends_on is null or phase.ends_on > v_period_start)
      order by phase.starts_on desc limit 1
    ) phase on true
    where s.status = 'active' and s.created_at::date < p_period_end
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_subscription.subscription_id::text, 0));
    v_venue_count := public.tenant_billable_venue_count(v_subscription.tenant_id);
    v_subtotal_cents := case when v_subscription.phase_kind = 'fixed_amount'
      then v_subscription.fixed_amount_cents else v_subscription.monthly_price_cents end
      + (v_venue_count - 1) * v_subscription.extra_venue_monthly_price_cents;
    if v_subscription.phase_kind = 'percent_discount' then
      v_subtotal_cents := round(v_subtotal_cents * (10000 - v_subscription.percent_discount_bps) / 10000.0);
    end if;

    insert into public.platform_billing_invoices (
      tenant_id, subscription_id, period_start, period_end, subtotal_cents, vat_rate_bps, vat_cents,
      total_cents, due_on, venue_count
    ) values (
      v_subscription.tenant_id, v_subscription.subscription_id, v_period_start, p_period_end, v_subtotal_cents,
      2100, round(v_subtotal_cents * 2100 / 10000.0), v_subtotal_cents + round(v_subtotal_cents * 2100 / 10000.0),
      p_period_end, v_venue_count
    ) on conflict (subscription_id, period_start) do nothing
    returning id into v_billing_invoice_id;

    if v_billing_invoice_id is not null then
      perform public.create_platform_fiscal_invoice(v_billing_invoice_id);
      update public.subscriptions set next_payment_on = (p_period_end + interval '1 month')::date
      where id = v_subscription.subscription_id;
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

revoke execute on function public.create_platform_fiscal_invoice(uuid) from public, anon, authenticated;
revoke execute on function public.generate_platform_month_end_invoices(date) from public, anon, authenticated;
grant execute on function public.create_platform_fiscal_invoice(uuid) to service_role;
grant execute on function public.generate_platform_month_end_invoices(date) to service_role;

alter table public.platform_fiscal_settings enable row level security;
alter table public.platform_fiscal_settings force row level security;
alter table public.platform_fiscal_invoices enable row level security;
alter table public.platform_fiscal_invoices force row level security;
alter table public.platform_fiscal_outbox enable row level security;
alter table public.platform_fiscal_outbox force row level security;

create policy platform_fiscal_settings_platform_owner on public.platform_fiscal_settings
  for all to authenticated using (public.is_platform_owner()) with check (public.is_platform_owner());
create policy platform_fiscal_invoices_read on public.platform_fiscal_invoices
  for select to authenticated using (
    public.is_platform_owner()
    or public.has_tenant_role(tenant_id, array['owner', 'manager', 'accountant']::public.tenant_role[])
  );
create policy platform_fiscal_outbox_platform_owner_read on public.platform_fiscal_outbox
  for select to authenticated using (public.is_platform_owner());