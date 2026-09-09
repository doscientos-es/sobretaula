-- El PKCS#12 sólo se conserva cifrado en Vault. La tabla almacena metadatos
-- derivados y una referencia no descargable al secreto.
alter table public.tenant_fiscal_settings
  add column certificate_secret_id uuid,
  add column certificate_subject text;

create or replace function public.replace_tenant_verifactu_certificate(
  p_tenant_id uuid,
  p_certificate_base64 text,
  p_fingerprint text,
  p_subject text,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_secret_id uuid;
  v_secret_name text;
begin
  if v_actor_id is null
    or not public.has_tenant_role(p_tenant_id, array['owner']::public.tenant_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_certificate_base64 !~ '^[A-Za-z0-9+/]+={0,2}$'
    or length(p_certificate_base64) > 2796204
    or octet_length(decode(p_certificate_base64, 'base64')) > 2 * 1024 * 1024
    or p_fingerprint !~ '^[a-f0-9]{64}$'
    or length(btrim(p_subject)) not between 1 and 400
    or p_expires_at <= now() then
    raise exception 'invalid_certificate_metadata' using errcode = '22023';
  end if;

  select certificate_secret_id
  into v_secret_id
  from public.tenant_fiscal_settings
  where tenant_id = p_tenant_id
  for update;
  if not found then
    raise exception 'fiscal_settings_not_configured' using errcode = '23503';
  end if;

  v_secret_name := format('verifactu-%s', p_tenant_id);
  if v_secret_id is null then
    v_secret_id := vault.create_secret(
      p_certificate_base64,
      v_secret_name,
      'PKCS#12 VERI*FACTU; managed by SobreTaula',
      null
    );
  else
    perform vault.update_secret(
      v_secret_id,
      p_certificate_base64,
      v_secret_name,
      'PKCS#12 VERI*FACTU; managed by SobreTaula',
      null
    );
  end if;

  update public.tenant_fiscal_settings
  set certificate_expires_at = p_expires_at,
      certificate_fingerprint = p_fingerprint,
      certificate_secret_id = v_secret_id,
      certificate_subject = btrim(p_subject)
  where tenant_id = p_tenant_id;

  insert into public.fiscal_settings_audit (tenant_id, action, detail, actor_id)
  values (
    p_tenant_id,
    'certificate_replaced',
    jsonb_build_object('expires_at', p_expires_at, 'fingerprint', p_fingerprint, 'subject', btrim(p_subject)),
    v_actor_id
  );
end;
$$;

revoke execute on function public.replace_tenant_verifactu_certificate(uuid, text, text, text, timestamptz) from public, anon;
grant execute on function public.replace_tenant_verifactu_certificate(uuid, text, text, text, timestamptz) to authenticated;