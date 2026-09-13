import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { authMiddleware } from '@/features/auth/infrastructure/server/auth-middleware'
import {
  operationalTenantMiddleware,
  tenantMembershipMiddleware,
} from '@/features/tenancy/application/require-tenant-membership'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

import { benchmarkVenues, type VenueBenchmark } from '../domain/venue-benchmark'
const input = z.object({
  tenantId: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
})
export const getVenueBenchmark = createServerFn({ method: 'GET' })
  .middleware([authMiddleware, tenantMembershipMiddleware, operationalTenantMiddleware])
  .validator(input)
  .handler(async ({ context, data }): Promise<VenueBenchmark[]> => {
    if (!['owner', 'manager', 'accountant'].includes(context.tenantMembership.role))
      throw new Response('Forbidden', { status: 403 })
    const supabase = createRequestSupabaseClient(context.tenantMembership.accessToken)
    const { data: venues, error } = await supabase
      .from('venues')
      .select('id, name')
      .eq('tenant_id', data.tenantId)
      .eq('is_active', true)
      .order('name')
    if (error) throw new Error(`venue_benchmark_venues_failed:${error.code}`)
    const metrics = await Promise.all(
      (venues ?? []).map(async (venue) => {
        const sessions = await supabase
          .from('table_sessions')
          .select('id')
          .eq('tenant_id', data.tenantId)
          .eq('venue_id', venue.id)
          .gte('opened_at', data.from)
          .lt('opened_at', data.to)
        if (sessions.error)
          throw new Error(`venue_benchmark_sessions_failed:${sessions.error.code}`)
        const ids = (sessions.data ?? []).map((session) => session.id)
        const [payments, waste] = await Promise.all([
          ids.length
            ? supabase
                .from('payments')
                .select('amount_cents')
                .eq('tenant_id', data.tenantId)
                .in('session_id', ids)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from('inventory_movements')
            .select('quantity, unit_cost_cents')
            .eq('tenant_id', data.tenantId)
            .eq('venue_id', venue.id)
            .eq('kind', 'waste')
            .gte('created_at', data.from)
            .lt('created_at', data.to),
        ])
        if (payments.error || waste.error) throw new Error('venue_benchmark_metrics_failed')
        const sales = (payments.data ?? []).reduce(
          (sum, payment) => sum + Number(payment.amount_cents),
          0,
        )
        const wasteCents = (waste.data ?? []).reduce(
          (sum, movement) =>
            sum +
            Math.round(Math.abs(Number(movement.quantity)) * Number(movement.unit_cost_cents ?? 0)),
          0,
        )
        return {
          venueId: venue.id as string,
          venueName: venue.name as string,
          netSalesCents: sales,
          contributionCents: sales - wasteCents,
          wasteCents,
        }
      }),
    )
    return benchmarkVenues(metrics)
  })
