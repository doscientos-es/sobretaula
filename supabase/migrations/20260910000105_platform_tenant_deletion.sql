-- Permite a un propietario de plataforma borrar de forma permanente un
-- tenant, pero solo una vez está suspendido y sin facturas retenidas por
-- obligación legal (Veri*factu / cobros SaaS), que deben conservarse.

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
  v_name text;
  v_slug text;
  v_billing_invoice_count bigint;
  v_fiscal_invoice_count bigint;
begin
  if not public.is_platform_owner() or length(btrim(p_reason)) < 5 then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select status, name, slug into v_status, v_name, v_slug
  from public.tenants where id = p_tenant_id for update;
  if v_status is null then raise exception 'tenant_not_found' using errcode = '22023'; end if;
  if v_status <> 'suspended' then
    raise exception 'tenant_not_suspended' using errcode = 'ST001';
  end if;

  select count(*) into v_billing_invoice_count
  from public.platform_billing_invoices where tenant_id = p_tenant_id;
  select count(*) into v_fiscal_invoice_count
  from public.platform_fiscal_invoices where tenant_id = p_tenant_id;
  if v_billing_invoice_count > 0 or v_fiscal_invoice_count > 0 then
    raise exception 'tenant_has_retained_records' using errcode = 'ST002';
  end if;

  insert into public.platform_audit_log (actor_user_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'tenant_deleted', 'tenant', p_tenant_id,
    jsonb_build_object('name', v_name, 'slug', v_slug, 'reason', btrim(p_reason)));

  delete from public.tenants where id = p_tenant_id;
end;
$$;

revoke execute on function public.delete_platform_tenant(uuid, text) from public, anon;
grant execute on function public.delete_platform_tenant(uuid, text) to authenticated;
