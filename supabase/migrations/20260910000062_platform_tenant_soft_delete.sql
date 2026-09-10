-- Por obligación legal (Veri*factu / facturación SaaS) un tenant nunca se
-- destruye físicamente. El "borrado" pasa a marcar el registro con
-- deleted_at y a ocultarlo de la consola de plataforma, conservando intacto
-- el histórico fiscal y de auditoría.

alter table public.tenants add column if not exists deleted_at timestamptz;

create or replace function public.delete_platform_tenant(
  p_tenant_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.tenant_status;
  v_deleted_at timestamptz;
  v_name text;
  v_slug text;
begin
  if not public.is_platform_owner() or length(btrim(p_reason)) < 5 then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select status, deleted_at, name, slug into v_status, v_deleted_at, v_name, v_slug
  from public.tenants where id = p_tenant_id for update;
  if v_status is null then raise exception 'tenant_not_found' using errcode = '22023'; end if;
  if v_deleted_at is not null then
    raise exception 'tenant_already_deleted' using errcode = 'ST003';
  end if;
  if v_status <> 'suspended' then
    raise exception 'tenant_not_suspended' using errcode = 'ST001';
  end if;

  update public.tenants set deleted_at = now() where id = p_tenant_id;

  insert into public.platform_audit_log (actor_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'tenant_deleted', 'tenant', p_tenant_id,
    jsonb_build_object('name', v_name, 'slug', v_slug, 'reason', btrim(p_reason)));
end;
$$;

revoke execute on function public.delete_platform_tenant(uuid, text) from public, anon;
grant execute on function public.delete_platform_tenant(uuid, text) to authenticated;

-- El tenant archivado deja de resolverse en la ficha de plataforma: nunca
-- llega al frontend, aunque el registro y su auditoría se conservan.
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
  where t.id = p_tenant_id and t.deleted_at is null;
end;
$$;
