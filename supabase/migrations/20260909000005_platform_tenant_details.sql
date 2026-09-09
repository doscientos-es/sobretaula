-- Ficha de tenant para propietarios de plataforma: lectura agregada sin abrir
-- políticas RLS de las operaciones diarias a toda la plataforma.

alter table public.platform_audit_log
  drop constraint if exists platform_audit_log_action_check;
alter table public.platform_audit_log
  add constraint platform_audit_log_action_check check (action in (
    'platform_invitation_created',
    'platform_invitation_accepted',
    'platform_member_granted',
    'platform_member_role_changed',
    'platform_member_revoked',
    'tenant_status_changed',
    'tenant_settings_updated'
  ));

create or replace function public.platform_tenant_overview(p_tenant_id uuid)
returns table (
  tenant_id uuid,
  tenant_name text,
  tenant_slug text,
  tenant_status public.tenant_status,
  default_locale public.app_locale,
  tenant_timezone text,
  created_at timestamptz,
  active_venue_count integer,
  active_member_count integer,
  reservation_count_last_30_days integer,
  closed_session_count_last_30_days integer,
  payment_total_cents_last_30_days bigint,
  fiscal_issuer_nif text,
  fiscal_legal_name text,
  verifactu_environment public.verifactu_env,
  certificate_configured boolean,
  certificate_expires_at timestamptz,
  invoice_series_count integer,
  invoice_count integer,
  invoice_total_cents bigint,
  registered_invoice_count integer,
  verifactu_ledger_count integer,
  outbox_pending_count integer,
  outbox_error_count integer,
  last_invoice_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    t.id, t.name, t.slug, t.status, t.default_locale, t.timezone, t.created_at,
    (select count(*)::integer from public.venues v where v.tenant_id = t.id and v.is_active),
    (select count(*)::integer from public.memberships m where m.tenant_id = t.id and m.status = 'active'),
    (select count(*)::integer from public.reservations r where r.tenant_id = t.id and r.starts_at >= now() - interval '30 days'),
    (select count(*)::integer from public.table_sessions s where s.tenant_id = t.id and s.status = 'closed' and s.closed_at >= now() - interval '30 days'),
    (select coalesce(sum(p.amount_cents + p.tip_cents), 0)::bigint from public.payments p where p.tenant_id = t.id and p.paid_at >= now() - interval '30 days'),
    f.issuer_nif, f.legal_name, f.environment,
    coalesce(f.certificate_object_path is not null, false), f.certificate_expires_at,
    (select count(*)::integer from public.invoice_series i_s where i_s.tenant_id = t.id),
    (select count(*)::integer from public.invoices i where i.tenant_id = t.id),
    (select coalesce(sum(i.total_cents), 0)::bigint from public.invoices i where i.tenant_id = t.id),
    (select count(*)::integer from public.invoices i where i.tenant_id = t.id and i.status = 'registered'),
    (select count(*)::integer from public.verifactu_ledger l where l.tenant_id = t.id),
    (select count(*)::integer from public.verifactu_outbox o where o.tenant_id = t.id and o.status in ('pending', 'processing', 'retryable_error')),
    (select count(*)::integer from public.verifactu_outbox o where o.tenant_id = t.id and o.status in ('rejected', 'terminal_error')),
    (select max(i.issued_at) from public.invoices i where i.tenant_id = t.id)
  from public.tenants t
  left join public.tenant_fiscal_settings f on f.tenant_id = t.id
  where t.id = p_tenant_id;
end;
$$;

create or replace function public.update_platform_tenant_configuration(
  p_tenant_id uuid,
  p_name text,
  p_default_locale public.app_locale,
  p_timezone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous public.tenants%rowtype;
begin
  if not public.is_platform_owner()
    or length(btrim(p_name)) = 0
    or length(btrim(p_name)) > 120
    or not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'invalid_platform_tenant_configuration' using errcode = '22023';
  end if;

  select * into v_previous from public.tenants where id = p_tenant_id for update;
  if v_previous.id is null then
    raise exception 'tenant_not_found' using errcode = '22023';
  end if;

  update public.tenants
  set name = btrim(p_name), default_locale = p_default_locale, timezone = p_timezone
  where id = p_tenant_id;

  insert into public.platform_audit_log (actor_user_id, action, target_type, target_id, metadata)
  values (
    auth.uid(), 'tenant_settings_updated', 'tenant', p_tenant_id,
    jsonb_build_object(
      'from', jsonb_build_object('name', v_previous.name, 'default_locale', v_previous.default_locale, 'timezone', v_previous.timezone),
      'to', jsonb_build_object('name', btrim(p_name), 'default_locale', p_default_locale, 'timezone', p_timezone)
    )
  );
end;
$$;

revoke execute on function public.platform_tenant_overview(uuid) from public, anon;
revoke execute on function public.update_platform_tenant_configuration(uuid, text, public.app_locale, text) from public, anon;
grant execute on function public.platform_tenant_overview(uuid) to authenticated;
grant execute on function public.update_platform_tenant_configuration(uuid, text, public.app_locale, text) to authenticated;