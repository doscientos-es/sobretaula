import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { findSeatingConflicts, mergeTableIds, seatingCapacity } from '../domain/service-board'
import { loadServiceBoard } from '../infrastructure/server/service-board-repository'
import {
  closeSessionInput,
  mergeSessionsInput,
  moveSessionInput,
  noShowReservationInput,
  operationId,
  requireServiceEditor,
  seatWalkInInput,
  serviceVenueInput,
} from './service-schema'

const seatReservationInput = serviceVenueInput.extend({
  operationId,
  reservationId: z.string().uuid(),
})

interface OpenSession {
  covers: number
  id: string
  reservationId: string | null
  tableIds: string[]
}

async function requireOpenSession(
  supabase: SupabaseClient,
  { sessionId, tenantId, venueId }: { sessionId: string; tenantId: string; venueId: string },
): Promise<OpenSession> {
  const { data, error } = await supabase
    .from('table_sessions')
    .select('covers, id, reservation_id, table_ids')
    .eq('id', sessionId)
    .eq('tenant_id', tenantId)
    .eq('venue_id', venueId)
    .eq('status', 'open')
    .single()
  if (error || !data) throw new Response('Not found', { status: 404 })

  return {
    covers: data.covers as number,
    id: data.id as string,
    reservationId: data.reservation_id as string | null,
    tableIds: data.table_ids as string[],
  }
}

/** Opens the live table session and converts its pending reservation into seated. */
export const seatReservation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(seatReservationInput)
  .handler(async ({ context, data }) => {
    requireServiceEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('id, party_size, status, venue_id')
      .eq('id', data.reservationId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .in('status', ['pending', 'confirmed'])
      .single()
    if (reservationError || !reservation) throw new Response('Not found', { status: 404 })
    const { data: assignments, error: assignmentsError } = await supabase
      .from('reservation_tables')
      .select('table_id')
      .eq('reservation_id', reservation.id)
    if (assignmentsError || !assignments?.length)
      throw new Response('Invalid reservation', { status: 422 })
    const sessionInsert = {
      covers: reservation.party_size,
      opened_by: context.tenantMembership.userId,
      operation_id: data.operationId ?? null,
      reservation_id: reservation.id,
      status: 'open' as const,
      table_ids: assignments.map((assignment) => assignment.table_id),
      tenant_id: data.tenantId,
      venue_id: reservation.venue_id,
    }
    const { data: session, error: sessionError } = await supabase
      .from('table_sessions')
      .upsert(sessionInsert, { onConflict: 'operation_id' })
      .select('id')
      .single()
    if (sessionError || !session)
      throw new Error(`table_session_create_failed:${sessionError?.code ?? 'unknown'}`)
    const { error: statusError } = await supabase
      .from('reservations')
      .update({ status: 'seated' })
      .eq('id', reservation.id)
    if (statusError) {
      await supabase.from('table_sessions').delete().eq('id', session.id)
      throw new Error(`reservation_seat_failed:${statusError.code}`)
    }
    return { sessionId: session.id }
  })

/** Marks an unarrived booking as no-show and releases its reserved tables. */
export const markReservationNoShow = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(noShowReservationInput)
  .handler(async ({ context, data }) => {
    requireServiceEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('id, starts_at')
      .eq('id', data.reservationId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .in('status', ['pending', 'confirmed'])
      .maybeSingle()
    if (error) throw new Error(`reservation_no_show_failed:${error.code}`)
    if (!reservation) throw new Response('Not found', { status: 404 })
    if (Date.now() - new Date(reservation.starts_at as string).getTime() < 15 * 60_000)
      throw new Response('Too early for no-show', { status: 422 })
    const { error: updateError } = await supabase
      .from('reservations')
      .update({ status: 'no_show' })
      .eq('id', reservation.id)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .in('status', ['pending', 'confirmed'])
    if (updateError) throw new Error(`reservation_no_show_failed:${updateError.code}`)
    return { reservationId: reservation.id as string }
  })

export const cancelReservation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(noShowReservationInput)
  .handler(async ({ context, data }) => {
    requireServiceEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: reservation, error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', data.reservationId)
      .eq('tenant_id', data.tenantId)
      .eq('venue_id', data.venueId)
      .in('status', ['pending', 'confirmed'])
      .select('id')
      .maybeSingle()
    if (error) throw new Error(`reservation_cancel_failed:${error.code}`)
    if (!reservation) throw new Response('Not found', { status: 404 })
    return { reservationId: reservation.id as string }
  })

/** Walk-in: the party has no booking, so the session opens straight on the plan. */
export const seatWalkIn = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(seatWalkInInput)
  .handler(async ({ context, data }) => {
    requireServiceEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    if (data.operationId) {
      const { data: existingSession } = await supabase
        .from('table_sessions')
        .select('id')
        .eq('operation_id', data.operationId)
        .eq('tenant_id', data.tenantId)
        .eq('venue_id', data.venueId)
        .maybeSingle()
      if (existingSession) return { sessionId: existingSession.id as string }
    }
    const board = await loadServiceBoard(supabase, {
      now: new Date(),
      tenantId: data.tenantId,
      venueId: data.venueId,
    })
    const busy = findSeatingConflicts(board.tables, data.tableIds)
    if (busy.length > 0) throw new Response('Table occupied', { status: 409 })
    if (seatingCapacity(board.tables, data.tableIds) < data.covers)
      throw new Response('Not enough seats', { status: 422 })

    const { data: session, error } = await supabase
      .from('table_sessions')
      .upsert(
        {
          covers: data.covers,
          opened_by: context.tenantMembership.userId,
          operation_id: data.operationId ?? null,
          status: 'open',
          table_ids: data.tableIds,
          tenant_id: data.tenantId,
          venue_id: data.venueId,
        },
        { onConflict: 'operation_id' },
      )
      .select('id')
      .single()
    if (error || !session)
      throw new Error(`table_session_create_failed:${error?.code ?? 'unknown'}`)

    return { sessionId: session.id as string }
  })

/** Moves a seated party to other tables without touching its account. */
export const moveSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(moveSessionInput)
  .handler(async ({ context, data }) => {
    requireServiceEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const session = await requireOpenSession(supabase, {
      sessionId: data.sessionId,
      tenantId: data.tenantId,
      venueId: data.venueId,
    })
    const board = await loadServiceBoard(supabase, {
      now: new Date(),
      tenantId: data.tenantId,
      venueId: data.venueId,
    })
    const busy = findSeatingConflicts(board.tables, data.tableIds, session.id)
    if (busy.length > 0) throw new Response('Table occupied', { status: 409 })
    if (seatingCapacity(board.tables, data.tableIds) < session.covers)
      throw new Response('Not enough seats', { status: 422 })

    const { error } = await supabase
      .from('table_sessions')
      .update({ table_ids: data.tableIds })
      .eq('id', session.id)
    if (error) throw new Error(`table_session_move_failed:${error.code}`)

    return { sessionId: session.id, tableIds: data.tableIds }
  })

/** Joins two seated parties into one account over the union of their tables. */
export const mergeSessions = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(mergeSessionsInput)
  .handler(async ({ context, data }) => {
    requireServiceEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const [source, target] = await Promise.all([
      requireOpenSession(supabase, {
        sessionId: data.sourceSessionId,
        tenantId: data.tenantId,
        venueId: data.venueId,
      }),
      requireOpenSession(supabase, {
        sessionId: data.targetSessionId,
        tenantId: data.tenantId,
        venueId: data.venueId,
      }),
    ])
    const { count, error: invoiceError } = await supabase
      .from('invoices')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', data.tenantId)
      .in('session_id', [source.id, target.id])
    if (invoiceError) throw new Error(`table_session_merge_check_failed:${invoiceError.code}`)
    if ((count ?? 0) > 0) throw new Response('Session already invoiced', { status: 409 })

    const { error } = await supabase
      .from('table_sessions')
      .update({
        covers: source.covers + target.covers,
        table_ids: mergeTableIds(target.tableIds, source.tableIds),
      })
      .eq('id', target.id)
    if (error) throw new Error(`table_session_merge_failed:${error.code}`)

    for (const table of ['orders', 'payments'] as const) {
      const { error: moveError } = await supabase
        .from(table)
        .update({ session_id: target.id })
        .eq('tenant_id', data.tenantId)
        .eq('session_id', source.id)
      if (moveError) throw new Error(`table_session_merge_${table}_failed:${moveError.code}`)
    }

    // Borrar la sesión origen arrastra en cascada comandas y cobros: sólo se
    // borra cuando ya no le queda nada colgando.
    for (const table of ['orders', 'payments'] as const) {
      const { count: left, error: leftError } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', data.tenantId)
        .eq('session_id', source.id)
      if (leftError) throw new Error(`table_session_merge_check_failed:${leftError.code}`)
      if ((left ?? 0) > 0) throw new Response('Forbidden', { status: 403 })
    }

    const { error: deleteError } = await supabase
      .from('table_sessions')
      .delete()
      .eq('id', source.id)
    if (deleteError) throw new Error(`table_session_merge_cleanup_failed:${deleteError.code}`)

    return { sessionId: target.id }
  })

/** Frees the tables and completes the booking that brought the party in. */
export const closeSession = createServerFn({ method: 'POST' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(closeSessionInput)
  .handler(async ({ context, data }) => {
    requireServiceEditor(context.tenantMembership.role)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const session = await requireOpenSession(supabase, {
      sessionId: data.sessionId,
      tenantId: data.tenantId,
      venueId: data.venueId,
    })

    // Nadie cierra una cuenta con saldo pendiente: primero se cobra en la cuenta.
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('tenant_id', data.tenantId)
      .eq('session_id', session.id)
    if (ordersError) throw new Error(`table_session_close_check_failed:${ordersError.code}`)
    const orderIds = (orders ?? []).map((order) => order.id as string)
    const [itemsResult, paymentsResult] = await Promise.all([
      orderIds.length === 0
        ? Promise.resolve({ data: [], error: null })
        : supabase
            .from('order_items')
            .select('quantity, unit_price_cents')
            .eq('tenant_id', data.tenantId)
            .in('order_id', orderIds),
      supabase
        .from('payments')
        .select('amount_cents')
        .eq('tenant_id', data.tenantId)
        .eq('session_id', session.id),
    ])
    if (itemsResult.error || paymentsResult.error) {
      throw new Error('table_session_close_check_failed')
    }
    const grossCents = (itemsResult.data ?? []).reduce(
      (sum, item) => sum + (item.quantity as number) * (item.unit_price_cents as number),
      0,
    )
    const paidCents = (paymentsResult.data ?? []).reduce(
      (sum, payment) => sum + (payment.amount_cents as number),
      0,
    )
    if (grossCents > paidCents) throw new Response('Unpaid balance', { status: 409 })

    const { error } = await supabase
      .from('table_sessions')
      .update({ closed_at: new Date().toISOString(), status: 'closed' })
      .eq('id', session.id)
    if (error) throw new Error(`table_session_close_failed:${error.code}`)

    if (session.reservationId) {
      const { error: reservationError } = await supabase
        .from('reservations')
        .update({ status: 'completed' })
        .eq('id', session.reservationId)
        .eq('tenant_id', data.tenantId)
      if (reservationError) throw new Error(`reservation_complete_failed:${reservationError.code}`)
    }

    return { sessionId: session.id }
  })
