import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from './require-tenant-membership'

const input = z.object({
  tenantId: z.string().uuid(),
  venueIds: z.array(z.string().uuid()),
})

export interface DashboardMetrics {
  nextReservationCovers: number | null
  nextReservationStartsAt: string | null
  reservationsToday: number
  occupiedTables: number
  paidTodayCents: number
}

export const getDashboardMetrics = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(input)
  .handler(async ({ context, data }): Promise<DashboardMetrics> => {
    if (data.venueIds.length === 0) {
      return {
        nextReservationCovers: null,
        nextReservationStartsAt: null,
        occupiedTables: 0,
        paidTodayCents: 0,
        reservationsToday: 0,
      }
    }
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const [reservations, sessions, nextReservation] = await Promise.all([
      supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', data.tenantId)
        .in('venue_id', data.venueIds)
        .gte('starts_at', start.toISOString())
        .lt('starts_at', end.toISOString())
        .in('status', ['pending', 'confirmed', 'seated']),
      supabase
        .from('table_sessions')
        .select('id, status, table_ids')
        .eq('tenant_id', data.tenantId)
        .in('venue_id', data.venueIds),
      supabase
        .from('reservations')
        .select('party_size, starts_at')
        .eq('tenant_id', data.tenantId)
        .in('venue_id', data.venueIds)
        .in('status', ['pending', 'confirmed'])
        .gte('starts_at', new Date().toISOString())
        .order('starts_at')
        .limit(1),
    ])
    if (reservations.error || sessions.error || nextReservation.error)
      throw new Error('dashboard_metrics_load_failed')
    const sessionIds = (sessions.data ?? []).map((session) => session.id as string)
    const payments =
      sessionIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from('payments')
            .select('amount_cents')
            .eq('tenant_id', data.tenantId)
            .in('session_id', sessionIds)
            .gte('paid_at', start.toISOString())
            .lt('paid_at', end.toISOString())
    if (payments.error) throw new Error('dashboard_metrics_load_failed')
    const occupiedTables = new Set(
      (sessions.data ?? [])
        .filter((session) => session.status === 'open')
        .flatMap((session) => session.table_ids as string[]),
    ).size
    const paidTodayCents = (payments.data ?? []).reduce(
      (sum, payment) => sum + (payment.amount_cents as number),
      0,
    )
    return {
      occupiedTables,
      paidTodayCents,
      reservationsToday: reservations.count ?? 0,
      nextReservationCovers: nextReservation.data?.[0]?.party_size ?? null,
      nextReservationStartsAt: nextReservation.data?.[0]?.starts_at ?? null,
    }
  })
