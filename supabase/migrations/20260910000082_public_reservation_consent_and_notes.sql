-- Datos públicos mínimos: comentario de la reserva y constancia de privacidad.
-- Las RPC anteriores se conservan para no interrumpir enlaces ni clientes activos.

alter table public.reservations
  add column if not exists privacy_notice_accepted_at timestamptz;

create or replace function public.enqueue_reservation_confirmation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.guest_id is not null and new.status in ('pending', 'confirmed') then
    insert into public.reservation_notification_jobs
      (tenant_id, reservation_id, guest_id, type, channel, locale, scheduled_for, dedupe_key)
    select new.tenant_id, new.id, new.guest_id, 'confirmation', 'email', g.locale, now(),
      new.id::text || ':confirmation'
    from public.guests g
    where g.id = new.guest_id and g.email is not null
    on conflict (tenant_id, dedupe_key) do nothing;
  end if;
  return new;
end;
$$;

create or replace function public.create_public_reservation_with_details(
  p_slug text,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_party_size integer,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_public_token_hash text,
  p_area_id uuid,
  p_notes text,
  p_privacy_accepted boolean
)
returns table (reservation_id uuid, starts_at timestamptz, ends_at timestamptz, venue_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation_id uuid;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_venue_name text;
begin
  if p_privacy_accepted is not true then
    raise exception 'public_privacy_notice_required' using errcode = '22023';
  end if;
  if p_notes is not null and length(btrim(p_notes)) > 1000 then
    raise exception 'public_reservation_notes_too_long' using errcode = '22023';
  end if;

  if p_area_id is null then
    select reservation_id, starts_at, ends_at, venue_name
    into v_reservation_id, v_starts_at, v_ends_at, v_venue_name
    from public.create_public_reservation(
      p_slug, p_service_id, p_starts_at, p_party_size, p_guest_name,
      p_guest_email, p_guest_phone, p_public_token_hash
    );
  else
    select reservation_id, starts_at, ends_at, venue_name
    into v_reservation_id, v_starts_at, v_ends_at, v_venue_name
    from public.create_public_reservation_in_area(
      p_slug, p_service_id, p_starts_at, p_party_size, p_guest_name,
      p_guest_email, p_guest_phone, p_public_token_hash, p_area_id
    );
  end if;

  update public.reservations
  set notes = nullif(btrim(p_notes), ''), privacy_notice_accepted_at = now()
  where id = v_reservation_id;

  return query select v_reservation_id, v_starts_at, v_ends_at, v_venue_name;
end;
$$;

revoke execute on function public.create_public_reservation_with_details(
  text, uuid, timestamptz, integer, text, text, text, text, uuid, text, boolean
) from public, authenticated;
grant execute on function public.create_public_reservation_with_details(
  text, uuid, timestamptz, integer, text, text, text, text, uuid, text, boolean
) to anon;