import { createFileRoute, notFound } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { getFloorPlan } from '@/features/floor-plan'
import { getServiceBoard, ServicePage } from '@/features/service'
import { loadVenueRouteContext } from '@/features/venues'

export const Route = createFileRoute('/t/$slug/l/$venue/servicio')({
  loader: async ({ params }) => {
    const routeContext = await loadVenueRouteContext(params.slug, params.venue)
    if (!routeContext) throw notFound()
    const { tenant, venue } = routeContext
    const data = { tenantId: tenant.id, venueId: venue.id }
    const [board, plan] = await Promise.all([getServiceBoard({ data }), getFloorPlan({ data })])

    return { board, plan, tenant, venue }
  },
  component: ServiceRoute,
  ...tenantRouteState,
})

function ServiceRoute() {
  const { board, plan, tenant, venue } = Route.useLoaderData()

  return <ServicePage board={board} plan={plan} tenantId={tenant.id} venueId={venue.id} />
}
