import { createHash, randomBytes } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { createAnonSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

const slugInput = z.object({ slug: z.string().trim().min(2).max(50) })
export const publicReservationInput = z.object({
  areaId: z.string().uuid().optional(),
  email: z.string().trim().email().max(200),
  guestName: z.string().trim().min(2).max(200),
  partySize: z.number().int().min(1).max(50),
  notes: z.string().trim().max(1000).optional(),
  phone: z.string().trim().min(6).max(40).optional(),
  privacyAccepted: z.literal(true),
  termsVersionId: z.string().uuid().optional(),
  serviceId: z.string().uuid(),
  slug: z.string().trim().min(2).max(50),
  startsAt: z.string().datetime({ offset: true }),
})
const tokenInput = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
const availabilityInput = z.object({
  areaId: z.string().uuid().optional(),
  date: z.string().date(),
  partySize: z.number().int().min(1).max(50),
  serviceId: z.string().uuid(),
  slug: z.string().trim().min(2).max(50),
})
const areasInput = z.object({ slug: z.string().trim().min(2).max(50) })

export interface PublicReservationService {
  endsAtTime: string
  id: string
  name: string
  slotMinutes: number
  startsAtTime: string
  weekday: number
}

export interface PublicReservationProfile {
  name: string
  slug: string
  timezone: string
  venueName: string
  services: PublicReservationService[]
  areas: Array<{ id: string; name: string }>
  terms: { body: string; id: string; title: string; version: number } | null
}

export interface PublicReservation {
  endsAt: string
  guestName?: string
  id: string
  partySize: number
  startsAt: string
  status: string
  tenantName: string
  timezone: string
  venueName: string
}

function hashPublicToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function hashRateKey(slug: string, email: string, phone?: string): string {
  return createHash('sha256')
    .update(`${slug}|${email.trim().toLowerCase()}|${phone?.trim() ?? ''}`)
    .digest('hex')
}

interface PublicReservationProfileRow {
  ends_at_time: string | null
  service_id: string | null
  service_name: string | null
  slot_minutes: number | null
  starts_at_time: string | null
  tenant_name: string
  tenant_slug: string
  timezone: string
  venue_name: string
  weekday: number
}

interface PublicReservationAreaRow {
  area_id: string
  area_name: string
}

interface PublicReservationTermsRow {
  body: string
  id: string
  locale: string
  title: string
  version: number
}

function isServiceRow(row: PublicReservationProfileRow): row is PublicReservationProfileRow & {
  ends_at_time: string
  service_id: string
  service_name: string
  starts_at_time: string
} {
  return Boolean(row.service_id && row.service_name && row.starts_at_time && row.ends_at_time)
}

export const getPublicReservationProfile = createServerFn({ method: 'GET' })
  .validator(slugInput)
  .handler(async ({ data }): Promise<PublicReservationProfile | null> => {
    const { data: rows, error } = await createAnonSupabaseClient().rpc(
      'public_reservation_profile',
      { p_slug: data.slug },
    )
    if (error) throw new Error(`public_reservation_profile_failed:${error.code}`)
    const typedRows = (rows ?? []) as PublicReservationProfileRow[]
    if (!typedRows.length) return null
    const first = typedRows[0]
    if (!first) return null
    const [areasResult, termsResult] = await Promise.all([
      createAnonSupabaseClient().rpc('public_reservation_areas', { p_slug: data.slug }),
      createAnonSupabaseClient().rpc('public_reservation_terms', { p_slug: data.slug }),
    ])
    if (termsResult.error) throw new Error(`public_reservation_terms_failed:${termsResult.error.code}`)
    const areaRows = areasResult.data
    const typedAreaRows = (areaRows ?? []) as PublicReservationAreaRow[]
    const terms = ((termsResult.data ?? []) as PublicReservationTermsRow[])[0]
    return {
      name: first.tenant_name,
      services: typedRows.filter(isServiceRow).map((row) => ({
        endsAtTime: row.ends_at_time,
        id: row.service_id,
        name: row.service_name,
        slotMinutes: row.slot_minutes ?? 15,
        startsAtTime: row.starts_at_time,
        weekday: row.weekday,
      })),
      areas: typedAreaRows.map((area) => ({ id: area.area_id, name: area.area_name })),
      slug: first.tenant_slug,
      timezone: first.timezone,
      venueName: first.venue_name,
      terms: terms
        ? { body: terms.body, id: terms.id, title: terms.title, version: terms.version }
        : null,
    }
  })

export const getPublicReservationAreas = createServerFn({ method: 'GET' })
  .validator(areasInput)
  .handler(async ({ data }) => {
    const { data: areas, error } = await createAnonSupabaseClient().rpc(
      'public_reservation_areas',
      { p_slug: data.slug },
    )
    if (error) throw new Error(`public_reservation_areas_failed:${error.code}`)
    const typedAreas = (areas ?? []) as PublicReservationAreaRow[]
    return typedAreas.map((area) => ({ id: area.area_id, name: area.area_name }))
  })

export const createPublicReservation = createServerFn({ method: 'POST' })
  .validator(publicReservationInput)
  .handler(async ({ data }) => {
    const token = randomBytes(32).toString('hex')
    const { data: result, error } = await createAnonSupabaseClient().rpc(
      'create_public_reservation_with_details_v2',
      {
        p_area_id: data.areaId ?? null,
        p_guest_email: data.email,
        p_guest_name: data.guestName,
        p_guest_phone: data.phone ?? null,
        p_notes: data.notes ?? null,
        p_party_size: data.partySize,
        p_privacy_accepted: data.privacyAccepted,
        p_public_token_hash: hashPublicToken(token),
        p_rate_key: hashRateKey(data.slug, data.email, data.phone),
        p_service_id: data.serviceId,
        p_slug: data.slug,
        p_starts_at: data.startsAt,
        p_terms_version_id: data.termsVersionId ?? null,
      },
    )
    if (error) {
      if (error.code === '23P01' || error.message.includes('public_slot_unavailable')) {
        throw new Response('Slot unavailable', { status: 409 })
      }
      if (error.message.includes('public_reservation_rate_limited')) {
        throw new Response('Too many attempts', { status: 429 })
      }
      if (error.message.includes('invalid_terms_version')) {
        throw new Response('Terms version unavailable', { status: 422 })
      }
      if (error.code === 'P0002') throw new Response('Not found', { status: 404 })
      throw new Error(`public_reservation_create_failed:${error.code}`)
    }
    const row = Array.isArray(result) ? result[0] : result
    if (!row) throw new Error('public_reservation_empty_response')
    return {
      endsAt: row.ends_at,
      reservationId: row.reservation_id,
      startsAt: row.starts_at,
      managementToken: token,
      venueName: row.venue_name,
    }
  })

export const getPublicReservation = createServerFn({ method: 'GET' })
  .validator(tokenInput)
  .handler(async ({ data }): Promise<PublicReservation | null> => {
    const { data: rows, error } = await createAnonSupabaseClient().rpc(
      'public_reservation_by_token',
      { p_token_hash: hashPublicToken(data.token) },
    )
    if (error) throw new Error(`public_reservation_lookup_failed:${error.code}`)
    const row = (rows ?? [])[0] as
      | {
          ends_at: string
          id: string
          party_size: number
          starts_at: string
          status: string
          tenant_name: string
          venue_name: string
          timezone: string
        }
      | undefined
    if (!row) return null
    return {
      endsAt: row.ends_at,
      id: row.id,
      partySize: row.party_size,
      startsAt: row.starts_at,
      status: row.status,
      tenantName: row.tenant_name,
      timezone: row.timezone,
      venueName: row.venue_name,
    }
  })

export const getPublicReservationAvailability = createServerFn({
  method: 'GET',
})
  .validator(availabilityInput)
  .handler(async ({ data }): Promise<string[]> => {
    const rpcName = data.areaId
      ? 'public_reservation_availability_for_area'
      : 'public_reservation_availability'
    const rpcArgs = data.areaId
      ? {
          p_area_id: data.areaId,
          p_date: data.date,
          p_party_size: data.partySize,
          p_service_id: data.serviceId,
          p_slug: data.slug,
        }
      : {
          p_date: data.date,
          p_party_size: data.partySize,
          p_service_id: data.serviceId,
          p_slug: data.slug,
        }
    const { data: rows, error } = await createAnonSupabaseClient().rpc(rpcName, rpcArgs)
    if (error) throw new Error(`public_reservation_availability_failed:${error.code}`)
    return ((rows ?? []) as Array<{ starts_at: string }>).map((row) => row.starts_at)
  })

export const cancelPublicReservation = createServerFn({ method: 'POST' })
  .validator(tokenInput)
  .handler(async ({ data }) => {
    const { data: cancelled, error } = await createAnonSupabaseClient().rpc(
      'cancel_public_reservation',
      { p_token_hash: hashPublicToken(data.token) },
    )
    if (error) throw new Error(`public_reservation_cancel_failed:${error.code}`)
    return { cancelled: cancelled === true }
  })

export const reschedulePublicReservation = createServerFn({ method: 'POST' })
  .validator(
    z.object({ startsAt: z.string().datetime({ offset: true }), token: tokenInput.shape.token }),
  )
  .handler(async ({ data }) => {
    const { data: updated, error } = await createAnonSupabaseClient().rpc(
      'reschedule_public_reservation',
      { p_starts_at: data.startsAt, p_token_hash: hashPublicToken(data.token) },
    )
    if (error) throw new Error(`public_reservation_reschedule_failed:${error.code}`)
    return { rescheduled: updated === true }
  })
