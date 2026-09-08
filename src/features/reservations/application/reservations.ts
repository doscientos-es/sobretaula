import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { tenantMembershipMiddleware } from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import {
  checkAvailability,
  type AvailabilityRule,
  type ReservationWindow,
} from '../domain/availability'

const tenantInput = z.object({ tenantId: z.string().uuid() })
const serviceInput = tenantInput.extend({
  endsAtTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  maxCoversPerSlot: z.number().int().positive().nullable(),
  maxReservationsPerSlot: z.number().int().positive().nullable(),
  name: z.string().trim().min(1).max(100),
  slotMinutes: z.number().int().min(5).max(120),
  startsAtTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  venueId: z.string().uuid(),
  weekday: z.number().int().min(0).max(6),
})
const reservationInput = tenantInput.extend({
  guestName: z.string().trim().min(1).max(200).optional(),
  partySize: z.number().int().min(1).max(50),
  serviceId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
})

export interface ReservationService {
  endsAtTime: string
  id: string
  name: string
  startsAtTime: string
  weekday: number
}

function requireReservationEditor(role: string): void {
  if (!['owner', 'manager', 'host'].includes(role)) throw new Response('Forbidden', { status: 403 })
}

function serviceBoundary(date: Date, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const boundary = new Date(date)
  boundary.setUTCHours(hours, minutes, 0, 0)
  return boundary
}

function parsePeriod(period: string): { endsAt: Date; startsAt: Date } {
  const [startsAt, endsAt] = period.slice(1, -1).split(',')
  return { endsAt: new Date(endsAt), startsAt: new Date(startsAt) }
}

export const getReservationServices = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(tenantInput)
  .handler(async ({ context, data }): Promise<ReservationService[]> => {
    const { data: services, error } = await createRequestSupabaseClient(
      context.tenantMembership.accessToken,
    )
      .from('services')
      .select('ends_at_time, id, name, starts_at_time, weekday')
      .eq('tenant_id', data.tenantId)
      .eq('is_active', true)
      .order('name')
    if (error) throw new Error(`reservation_services_load_failed:${error.code}`)
    return (services ?? []).map((service) => ({
      endsAtTime: service.ends_at_time,
      id: service.id,
      name: service.name,
      startsAtTime: service.starts_at_time,
      weekday: service.weekday,
    }))
  })

export const createReservationService = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(serviceInput)
  .handler(async ({ context, data }) => {
    requireReservationEditor(context.tenantMembership.role)
    if (data.endsAtTime <= data.startsAtTime) throw new Response('Invalid service', { status: 422 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .insert({
        ends_at_time: data.endsAtTime,
        name: data.name,
        starts_at_time: data.startsAtTime,
        tenant_id: data.tenantId,
        venue_id: data.venueId,
        weekday: data.weekday,
      })
      .select('id')
      .single()
    if (serviceError || !service) {
      throw new Error(`reservation_service_create_failed:${serviceError?.code ?? 'unknown'}`)
    }
    const { error: ruleError } = await supabase.from('availability_rules').insert({
      max_covers_per_slot: data.maxCoversPerSlot,
      max_reservations_per_slot: data.maxReservationsPerSlot,
      service_id: service.id,
      slot_minutes: data.slotMinutes,
      tenant_id: data.tenantId,
    })
    if (ruleError) {
      await supabase.from('services').delete().eq('id', service.id)
      throw new Error(`reservation_rule_create_failed:${ruleError.code}`)
    }
    return { serviceId: service.id }
  })

export const createReservation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware])
  .validator(reservationInput)
  .handler(async ({ context, data }) => {
    requireReservationEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const requestedStartsAt = new Date(data.startsAt)
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('ends_at_time, id, starts_at_time, venue_id, weekday')
      .eq('id', data.serviceId)
      .eq('tenant_id', data.tenantId)
      .eq('is_active', true)
      .single()
    if (serviceError || !service) throw new Response('Not found', { status: 404 })
    if (requestedStartsAt.getUTCDay() !== service.weekday) {
      throw new Response('Outside service', { status: 422 })
    }

    const [ruleResult, tablesResult, reservationsResult, reservationTablesResult, closuresResult] =
      await Promise.all([
        supabase.from('availability_rules').select('*').eq('service_id', service.id).single(),
        supabase
          .from('tables')
          .select('id, is_bookable, max_seats, min_seats')
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', service.venue_id)
          .eq('is_active', true),
        supabase
          .from('reservations')
          .select('id, party_size')
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', service.venue_id),
        supabase
          .from('reservation_tables')
          .select('period, reservation_id, status, table_id')
          .eq('tenant_id', data.tenantId),
        supabase
          .from('closures')
          .select('period')
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', service.venue_id),
      ])
    if (
      ruleResult.error ||
      !ruleResult.data ||
      tablesResult.error ||
      reservationsResult.error ||
      reservationTablesResult.error ||
      closuresResult.error
    ) {
      throw new Error('reservation_availability_load_failed')
    }
    const partySizes = new Map(
      (reservationsResult.data ?? []).map((reservation) => [
        reservation.id,
        reservation.party_size,
      ]),
    )
    const occupied = new Map<string, ReservationWindow>()
    for (const assignment of reservationTablesResult.data ?? []) {
      const window = parsePeriod(assignment.period)
      const current = occupied.get(assignment.reservation_id)
      occupied.set(assignment.reservation_id, {
        ...window,
        partySize: partySizes.get(assignment.reservation_id) ?? 0,
        status: assignment.status,
        tableIds: current ? [...current.tableIds, assignment.table_id] : [assignment.table_id],
      })
    }
    const rule: AvailabilityRule = {
      durationMinutesByParty: ruleResult.data.duration_minutes_by_party as Record<string, number>,
      maxCoversPerSlot: ruleResult.data.max_covers_per_slot,
      maxLeadDays: ruleResult.data.max_lead_days,
      maxReservationsPerSlot: ruleResult.data.max_reservations_per_slot,
      minLeadMinutes: ruleResult.data.min_lead_minutes,
      slotMinutes: ruleResult.data.slot_minutes,
    }
    const availability = checkAvailability({
      closures: (closuresResult.data ?? []).map((closure) => parsePeriod(closure.period)),
      now: new Date(),
      partySize: data.partySize,
      requestedStartsAt,
      reservations: [...occupied.values()],
      rule,
      serviceEndsAt: serviceBoundary(requestedStartsAt, service.ends_at_time),
      serviceStartsAt: serviceBoundary(requestedStartsAt, service.starts_at_time),
      tables: (tablesResult.data ?? []).map((table) => ({
        id: table.id,
        isBookable: table.is_bookable,
        maxSeats: table.max_seats,
        minSeats: table.min_seats,
      })),
    })
    if (!availability.available) throw new Response(availability.reason, { status: 422 })

    let guestId: string | null = null
    if (data.guestName) {
      const { data: guest, error: guestError } = await supabase
        .from('guests')
        .insert({ full_name: data.guestName, tenant_id: data.tenantId })
        .select('id')
        .single()
      if (guestError || !guest) {
        throw new Error(`reservation_guest_create_failed:${guestError?.code ?? 'unknown'}`)
      }
      guestId = guest.id
    }
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .insert({
        created_by: context.tenantMembership.userId,
        ends_at: availability.endsAt.toISOString(),
        guest_id: guestId,
        party_size: data.partySize,
        source: 'staff',
        starts_at: requestedStartsAt.toISOString(),
        status: 'pending',
        tenant_id: data.tenantId,
        venue_id: service.venue_id,
      })
      .select('id')
      .single()
    if (reservationError || !reservation) {
      throw new Error(`reservation_create_failed:${reservationError?.code ?? 'unknown'}`)
    }
    const { error: assignmentError } = await supabase.from('reservation_tables').insert({
      period: `[${requestedStartsAt.toISOString()},${availability.endsAt.toISOString()})`,
      reservation_id: reservation.id,
      status: 'pending',
      table_id: availability.tableId,
      tenant_id: data.tenantId,
    })
    if (assignmentError) {
      await supabase.from('reservations').delete().eq('id', reservation.id)
      if (assignmentError.code === '23P01') throw new Response('Table unavailable', { status: 409 })
      throw new Error(`reservation_assignment_create_failed:${assignmentError.code}`)
    }
    return { reservationId: reservation.id, tableId: availability.tableId }
  })
