-- Facturación y fiscalidad VERI*FACTU.
-- La cadena de huellas es por NIF emisor y jamás se comparte entre tenants.

create table public.tenant_fiscal_settings (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  issuer_nif text not null check (issuer_nif ~ '^[A-Z0-9]{9}$'),
  legal_name text not null check (length(btrim(legal_name)) > 0),
  address_line text not null,
  city text not null,
  postal_code text not null,
  country_code text not null default 'ES',
  environment public.verifactu_env not null default 'test',
  certificate_object_path text,
  certificate_fingerprint text,
  certificate_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.fiscal_settings_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  action text not null check (action in ('created', 'certificate_replaced', 'certificate_revoked', 'environment_changed')),
  detail jsonb not null default '{}'::jsonb,
  actor_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.invoice_series (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  code text not null,
  fiscal_year smallint not null,
  next_number integer not null default 1 check (next_number > 0),
  created_at timestamptz not null default now(),
  unique (tenant_id, code, fiscal_year)
);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  series_id uuid not null references public.invoice_series (id) on delete restrict,
  session_id uuid references public.table_sessions (id) on delete set null,
  number integer not null check (number > 0),
  full_number text not null,
  issued_at timestamptz not null default now(),
  issuer_nif text not null,
  customer_nif text,
  customer_name text,
  status public.invoice_status not null default 'draft',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  vat_cents integer not null check (vat_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  lines jsonb not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, series_id, number),
  unique (tenant_id, full_number)
);

create table public.invoice_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  object_path text not null unique,
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique (invoice_id)
);

create table public.verifactu_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  issuer_nif text not null,
  chain_sequence bigint not null,
  previous_hash text,
  current_hash text not null,
  environment public.verifactu_env not null,
  payload jsonb not null,
  qr_payload text not null,
  created_at timestamptz not null default now(),
  unique (issuer_nif, chain_sequence),
  unique (invoice_id)
);

create table public.verifactu_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  ledger_id uuid not null references public.verifactu_ledger (id) on delete cascade,
  status public.verifactu_outbox_status not null default 'pending',
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  last_result jsonb,
  updated_at timestamptz not null default now(),
  unique (ledger_id)
);

create index verifactu_outbox_due_idx on public.verifactu_outbox (next_attempt_at)
  where status in ('pending', 'retryable_error');

create trigger tenant_fiscal_settings_set_updated_at before update on public.tenant_fiscal_settings
  for each row execute function public.set_updated_at();
create trigger verifactu_outbox_set_updated_at before update on public.verifactu_outbox
  for each row execute function public.set_updated_at();

-- Append-only real: ni la aplicación ni el propietario de la tabla pueden alterar
-- la cadena ni la factura emitida ni la auditoría fiscal.
create trigger fiscal_settings_audit_append_only
  before update or delete on public.fiscal_settings_audit
  for each row execute function public.forbid_mutation();
create trigger verifactu_ledger_append_only
  before update or delete on public.verifactu_ledger
  for each row execute function public.forbid_mutation();
create trigger invoice_documents_append_only
  before update or delete on public.invoice_documents
  for each row execute function public.forbid_mutation();

-- Reserva de número correlativa y atómica: el bloqueo lo hace Postgres, no la app.
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
  if v_tenant is null then
    raise exception 'invoice_series_not_found' using errcode = '22023';
  end if;
  if not public.has_tenant_role(v_tenant, array['owner', 'manager', 'accountant']::public.tenant_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  update public.invoice_series
  set next_number = next_number + 1
  where id = p_series_id
  returning next_number - 1 into v_number;

  return v_number;
end;
$$;

revoke execute on function public.reserve_invoice_number(uuid) from public;
grant execute on function public.reserve_invoice_number(uuid) to authenticated;
