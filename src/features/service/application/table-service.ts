import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

const seatReservationInput = z.object({
  reservationId: z.string().uuid(),
  tenantId: z.string().uuid(),
})

function requireServiceEditor(role: string): void {
  if (!['owner', 'manager', 'host', 'waiter'].includes(role))
    throw new Response('Forbidden', { status: 403 })
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
      .in('status', ['pending', 'confirmed'])
      .single()
    if (reservationError || !reservation) throw new Response('Not found', { status: 404 })
    const { data: assignments, error: assignmentsError } = await supabase
      .from('reservation_tables')
      .select('table_id')
      .eq('reservation_id', reservation.id)
    if (assignmentsError || !assignments?.length)
      throw new Response('Invalid reservation', { status: 422 })
    const { data: session, error: sessionError } = await supabase
      .from('table_sessions')
      .insert({
        covers: reservation.party_size,
        opened_by: context.tenantMembership.userId,
        reservation_id: reservation.id,
        status: 'open',
        table_ids: assignments.map((assignment) => assignment.table_id),
        tenant_id: data.tenantId,
        venue_id: reservation.venue_id,
      })
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
