import { createFileRoute, notFound } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { FloorPlanPage, getFloorPlan } from '@/features/floor-plan'
import { loadVenueRouteContext } from '@/features/venues'

export const Route = createFileRoute('/t/$slug/l/$venue/plano')({
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    const { tenant, venue } = routeContext
    return {
      data: await getFloorPlan({ data: { tenantId: tenant.id, venueId: venue.id } }),
      tenant,
      venue,
    }
  },
  component: FloorPlanRoute,
  ...tenantRouteState,
})

function FloorPlanRoute() {
  const { data, tenant, venue } = Route.useLoaderData()

  return <FloorPlanPage data={data} tenantId={tenant.id} venueId={venue.id} />
}
