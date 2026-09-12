import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import { getZonedWeekBounds } from '@/shared/lib/date/zoned-time'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { getDashboardActions, type TenantDashboardAction } from '../domain/dashboard-actions'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from './require-tenant-membership'

export const dashboardMetricsInput = z.object({
  tenantId: z.string().uuid(),
  // Older deployed route bundles did not send venueIds. Treat that request as
  // an empty dashboard while the deployment converges instead of rejecting it.
  venueIds: z.array(z.string().uuid()).default([]),
})

export interface DashboardMetrics {
  actionItems: TenantDashboardAction[]
  nextReservationCovers: number | null
  nextReservationStartsAt: string | null
  openSessionCount: number
  reservationsToday: number
  reservationsThisWeek: number
  noShowsThisWeek: number
  occupiedTables: number
  paidTodayCents: number
  pendingReservationsToday: number
}

export const getDashboardMetrics = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(dashboardMetricsInput)
  .handler(async ({ context, data }): Promise<DashboardMetrics> => {
    if (data.venueIds.length === 0) {
      return {
        actionItems: [],
        nextReservationCovers: null,
        nextReservationStartsAt: null,
        openSessionCount: 0,
        occupiedTables: 0,
        paidTodayCents: 0,
        pendingReservationsToday: 0,
        reservationsToday: 0,
        reservationsThisWeek: 0,
        noShowsThisWeek: 0,
      }
    }
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const tenantResult = await supabase
      .from('tenants')
      .select('timezone')
      .eq('id', data.tenantId)
      .single()
    if (tenantResult.error || !tenantResult.data) throw new Error('dashboard_metrics_load_failed')
    const now = new Date()
    const bounds = getZonedWeekBounds(now, tenantResult.data.timezone as string)
    const [
      reservations,
      noShowsWeek,
      reservationsWeek,
      sessions,
      nextReservation,
      pendingReservationCount,
      pendingReservations,
    ] = await Promise.all([
      supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', data.tenantId)
        .in('venue_id', data.venueIds)
        .gte('starts_at', bounds.dayStartIso)
        .lt('starts_at', bounds.dayEndIso)
        .in('status', ['pending', 'confirmed', 'seated']),
      supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', data.tenantId)
        .in('venue_id', data.venueIds)
        .gte('starts_at', bounds.weekStartIso)
        .lt('starts_at', bounds.weekEndIso)
        .eq('status', 'no_show'),
      supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', data.tenantId)
        .in('venue_id', data.venueIds)
        .gte('starts_at', bounds.weekStartIso)
        .lt('starts_at', bounds.weekEndIso)
        .in('status', ['pending', 'confirmed', 'seated']),
      supabase
        .from('table_sessions')
        .select('id, opened_at, status, table_ids, venue_id')
        .eq('tenant_id', data.tenantId)
        .in('venue_id', data.venueIds)
        .eq('status', 'open'),
      supabase
        .from('reservations')
        .select('party_size, starts_at')
        .eq('tenant_id', data.tenantId)
        .in('venue_id', data.venueIds)
        .in('status', ['pending', 'confirmed'])
        .gte('starts_at', now.toISOString())
        .order('starts_at')
        .limit(1),
      supabase
        .from('reservations')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', data.tenantId)
        .in('venue_id', data.venueIds)
        .gte('starts_at', bounds.dayStartIso)
        .lt('starts_at', bounds.dayEndIso)
        .eq('status', 'pending'),
      supabase
        .from('reservations')
        .select('id, party_size, starts_at, venue_id')
        .eq('tenant_id', data.tenantId)
        .in('venue_id', data.venueIds)
        .gte('starts_at', bounds.dayStartIso)
        .lt('starts_at', bounds.dayEndIso)
        .eq('status', 'pending')
        .order('starts_at')
        .limit(3),
    ])
    if (
      reservations.error ||
      reservationsWeek.error ||
      noShowsWeek.error ||
      sessions.error ||
      nextReservation.error ||
      pendingReservationCount.error ||
      pendingReservations.error
    )
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
            .gte('paid_at', bounds.dayStartIso)
            .lt('paid_at', bounds.dayEndIso)
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
      actionItems: getDashboardActions({
        openSessions: (sessions.data ?? []).map((session) => ({
          id: session.id as string,
          openedAt: session.opened_at as string,
          venueId: session.venue_id as string,
        })),
        pendingReservations: (pendingReservations.data ?? []).map((reservation) => ({
          id: reservation.id as string,
          partySize: reservation.party_size as number,
          startsAt: reservation.starts_at as string,
          venueId: reservation.venue_id as string,
        })),
      }),
      occupiedTables,
      openSessionCount: sessions.data?.length ?? 0,
      paidTodayCents,
      pendingReservationsToday: pendingReservationCount.count ?? 0,
      reservationsToday: reservations.count ?? 0,
      reservationsThisWeek: reservationsWeek.count ?? 0,
      noShowsThisWeek: noShowsWeek.count ?? 0,
      nextReservationCovers: nextReservation.data?.[0]?.party_size ?? null,
      nextReservationStartsAt: nextReservation.data?.[0]?.starts_at ?? null,
    }
  })
