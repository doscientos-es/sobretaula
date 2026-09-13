import { createFileRoute, notFound } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { loadFloorPlan } from '@/features/floor-plan/application/floor-plan'
import { ServicePage } from '@/features/service'
import { loadServiceBoard } from '@/features/service/infrastructure/server/service-board-repository'
import { loadVenueRouteContext } from '@/features/venues'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

export const Route = createFileRoute('/t/$slug/l/$venue/servicio')({
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(params.slug, params.venue)
    if (!routeContext) throw notFound()
    const { tenant, venue } = routeContext
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
  component: ServiceRoute,
  ...tenantRouteState,
})

function ServiceRoute() {
  const { board, plan, tenant, venue } = Route.useLoaderData()

  return <ServicePage board={board} plan={plan} tenantId={tenant.id} venueId={venue.id} />
}
