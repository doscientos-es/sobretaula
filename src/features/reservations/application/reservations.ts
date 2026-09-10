import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import {
  checkAvailability,
  type AvailabilityRule,
  type ReservationWindow,
} from '../domain/availability'

const tenantInput = z.object({ tenantId: z.string().uuid() })
const venueInput = tenantInput.extend({ venueId: z.string().uuid() })
const serviceInput = venueInput.extend({
  endsAtTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  maxCoversPerSlot: z.number().int().positive().nullable(),
  maxReservationsPerSlot: z.number().int().positive().nullable(),
  name: z.string().trim().min(1).max(100),
  slotMinutes: z.number().int().min(5).max(120),
  startsAtTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/),
  weekday: z.number().int().min(0).max(6),
})
const reservationInput = venueInput.extend({
  guestName: z.string().trim().min(1).max(200).optional(),
  guestPhone: z.string().trim().min(3).max(40).optional(),
  partySize: z.number().int().min(1).max(50),
  serviceId: z.string().uuid(),
  startsAt: z.string().datetime({ offset: true }),
})
const reservationsDateInput = venueInput.extend({ date: z.string().date() })

export interface ReservationService {
  endsAtTime: string
  id: string
  name: string
  startsAtTime: string
  venueId: string
  weekday: number
  slotMinutes: number
  maxCoversPerSlot: number | null
  maxReservationsPerSlot: number | null
}

export interface ReservationAgendaItem {
  guestName: string | null
  guestPhone: string | null
  id: string
  partySize: number
  startsAt: string
  status: string
  tableIds: string[]
}

function requireReservationEditor(role: string): void {
  if (!['owner', 'manager', 'host'].includes(role)) throw new Response('Forbidden', { status: 403 })
}

function serviceBoundary(date: Date, time: string): Date {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  const boundary = new Date(date)
  boundary.setUTCHours(hours, minutes, 0, 0)
  return boundary
}

function parsePeriod(period: string): { endsAt: Date; startsAt: Date } {
  const [startsAt, endsAt] = period.slice(1, -1).split(',')
  if (!startsAt || !endsAt) throw new Error('invalid_reservation_period')
  return { endsAt: new Date(endsAt), startsAt: new Date(startsAt) }
}

export const getReservationServices = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(venueInput)
  .handler(async ({ context, data }): Promise<ReservationService[]> => {
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: services, error } = await supabase
      .from('services')
      .select('ends_at_time, id, name, starts_at_time, venue_id, weekday')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .eq('is_active', true)
      .order('name')
    if (error) throw new Error(`reservation_services_load_failed:${error.code}`)
    const rows = services ?? []
    const { data: rules, error: rulesError } = rows.length
      ? await supabase
          .from('availability_rules')
          .select('max_covers_per_slot, max_reservations_per_slot, service_id, slot_minutes')
          .in(
            'service_id',
            rows.map((service) => service.id),
          )
      : { data: [], error: null }
    if (rulesError) throw new Error(`reservation_rules_load_failed:${rulesError.code}`)
    const rulesByService = new Map((rules ?? []).map((rule) => [rule.service_id, rule]))
    return rows.map((service) => ({
      endsAtTime: service.ends_at_time,
      id: service.id,
      name: service.name,
      startsAtTime: service.starts_at_time,
      venueId: service.venue_id,
      weekday: service.weekday,
      slotMinutes: rulesByService.get(service.id)?.slot_minutes ?? 15,
      maxCoversPerSlot: rulesByService.get(service.id)?.max_covers_per_slot ?? null,
      maxReservationsPerSlot: rulesByService.get(service.id)?.max_reservations_per_slot ?? null,
    }))
  })

export const getReservationsForDate = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(reservationsDateInput)
  .handler(async ({ context, data }): Promise<ReservationAgendaItem[]> => {
    const start = new Date(`${data.date}T00:00:00.000Z`)
    const end = new Date(`${data.date}T23:59:59.999Z`)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('guest_id, id, party_size, starts_at, status')
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .gte('starts_at', start.toISOString())
      .lte('starts_at', end.toISOString())
      .order('starts_at')
    if (error) throw new Error(`reservation_agenda_load_failed:${error.code}`)
    const rows = reservations ?? []
    const ids = rows.map((row) => row.id)
    const guestIds = rows.flatMap((row) => (row.guest_id ? [row.guest_id] : []))
    const [guestsResult, assignmentsResult] = await Promise.all([
      guestIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from('guests')
            .select('full_name, id, phone')
            .eq('tenant_id', data.tenantId)
            .in('id', guestIds),
      ids.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from('reservation_tables')
            .select('reservation_id, table_id')
            .eq('tenant_id', data.tenantId)
            .in('reservation_id', ids),
    ])
    if (guestsResult.error || assignmentsResult.error)
      throw new Error('reservation_agenda_load_failed')
    const guests = new Map((guestsResult.data ?? []).map((guest) => [guest.id, guest]))
    const tables = new Map<string, string[]>()
    for (const assignment of assignmentsResult.data ?? []) {
      tables.set(assignment.reservation_id, [
        ...(tables.get(assignment.reservation_id) ?? []),
        assignment.table_id,
      ])
    }
    return rows.map((row) => ({
      guestName: row.guest_id ? (guests.get(row.guest_id)?.full_name ?? null) : null,
      guestPhone: row.guest_id ? (guests.get(row.guest_id)?.phone ?? null) : null,
      id: row.id,
      partySize: row.party_size,
      startsAt: row.starts_at,
      status: row.status,
      tableIds: tables.get(row.id) ?? [],
    }))
  })

export const createReservationService = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
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
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
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
      .eq('venue_id', data.venueId)
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
    if (data.guestName || data.guestPhone) {
      const existing = data.guestPhone
        ? await supabase
            .from('guests')
            .select('id')
            .eq('tenant_id', data.tenantId)
            .eq('phone', data.guestPhone)
            .maybeSingle()
        : { data: null, error: null }
      if (existing.error) {
        throw new Error(`reservation_guest_lookup_failed:${existing.error.code}`)
      }
      const guest = existing.data
        ? existing
        : await supabase
            .from('guests')
            .insert({
              full_name: data.guestName ?? 'Sin nombre',
              phone: data.guestPhone ?? null,
              tenant_id: data.tenantId,
            })
            .select('id')
            .single()
      const guestError = guest.error
      if (guestError || !guest.data) {
        throw new Error(`reservation_guest_create_failed:${guestError?.code ?? 'unknown'}`)
      }
      guestId = guest.data.id as string
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
