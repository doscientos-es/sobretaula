import { createHash, randomBytes } from 'node:crypto'

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { createAnonSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

const slugInput = z.object({ slug: z.string().trim().min(2).max(50) })
const reservationInput = z.object({
  email: z.string().trim().email().max(200).optional(),
  guestName: z.string().trim().min(2).max(200),
  partySize: z.number().int().min(1).max(50),
  phone: z.string().trim().min(6).max(40).optional(),
  serviceId: z.string().uuid(),
  slug: z.string().trim().min(2).max(50),
  startsAt: z.string().datetime({ offset: true }),
})
const tokenInput = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
const availabilityInput = z.object({
  date: z.string().date(),
  partySize: z.number().int().min(1).max(50),
  serviceId: z.string().uuid(),
  slug: z.string().trim().min(2).max(50),
})

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
}

export interface PublicReservation {
  endsAt: string
  guestName?: string
  id: string
  partySize: number
  startsAt: string
  status: string
  tenantName: string
  venueName: string
}

function hashPublicToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
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
      slug: first.tenant_slug,
      timezone: first.timezone,
      venueName: first.venue_name,
    }
  })

export const createPublicReservation = createServerFn({ method: 'POST' })
  .validator(reservationInput)
  .handler(async ({ data }) => {
    const token = randomBytes(32).toString('hex')
    const { data: result, error } = await createAnonSupabaseClient().rpc(
      'create_public_reservation',
      {
        p_guest_email: data.email ?? null,
        p_guest_name: data.guestName,
        p_guest_phone: data.phone ?? null,
        p_party_size: data.partySize,
        p_service_id: data.serviceId,
        p_slug: data.slug,
        p_starts_at: data.startsAt,
        p_public_token_hash: hashPublicToken(token),
      },
    )
    if (error) {
      if (error.code === '23P01' || error.message.includes('public_slot_unavailable')) {
        throw new Response('Slot unavailable', { status: 409 })
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
      venueName: row.venue_name,
    }
  })

export const getPublicReservationAvailability = createServerFn({ method: 'GET' })
  .validator(availabilityInput)
  .handler(async ({ data }): Promise<string[]> => {
    const { data: rows, error } = await createAnonSupabaseClient().rpc(
      'public_reservation_availability',
      {
        p_date: data.date,
        p_party_size: data.partySize,
        p_service_id: data.serviceId,
        p_slug: data.slug,
      },
    )
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
