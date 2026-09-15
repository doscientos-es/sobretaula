import { createFileRoute } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { loadFloorPlan } from '@/features/floor-plan/application/floor-plan'
import { loadServiceBoard } from '@/features/service/infrastructure/server/service-board-repository'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

export const Route = createFileRoute('/t/$slug/l/$venue/servicio')({
  loader: async ({ context }) => {
    const { tenant, venue } = context
    const data = { tenantId: tenant.id, venueId: venue.id }
    const [board, plan] = await Promise.all([
      loadServiceBoard(createRequestSupabaseClient(context.tenantMembership.accessToken), {
        ...data,
        now: new Date(),
      }),
      loadFloorPlan(createRequestSupabaseClient(context.tenantMembership.accessToken), data),
    ])

    return { board, plan, tenant, venue }
  },
  ...tenantRouteState,
})
