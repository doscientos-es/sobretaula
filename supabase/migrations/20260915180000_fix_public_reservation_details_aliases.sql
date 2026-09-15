-- Califica las columnas de las RPC anidadas para evitar ambigüedad con los
-- parámetros OUT reservation_id, starts_at, ends_at y venue_name.
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
    select created.reservation_id, created.starts_at, created.ends_at, created.venue_name
    into v_reservation_id, v_starts_at, v_ends_at, v_venue_name
    from public.create_public_reservation(
      p_slug, p_service_id, p_starts_at, p_party_size, p_guest_name,
      p_guest_email, p_guest_phone, p_public_token_hash
    ) as created;
  else
    select created.reservation_id, created.starts_at, created.ends_at, created.venue_name
    into v_reservation_id, v_starts_at, v_ends_at, v_venue_name
    from public.create_public_reservation_in_area(
      p_slug, p_service_id, p_starts_at, p_party_size, p_guest_name,
      p_guest_email, p_guest_phone, p_public_token_hash, p_area_id
    ) as created;
  end if;

  update public.reservations
  set notes = nullif(btrim(p_notes), ''), privacy_notice_accepted_at = now()
  where id = v_reservation_id;

  return query select v_reservation_id, v_starts_at, v_ends_at, v_venue_name;
end;
$$;

grant execute on function public.create_public_reservation_with_details(
  text, uuid, timestamptz, integer, text, text, text, text, uuid, text, boolean
) to anon;
