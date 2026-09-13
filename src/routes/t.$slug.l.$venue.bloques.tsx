import { createFileRoute, notFound } from '@tanstack/react-router'

import { SchedulingBlocksPage } from '@/features/scheduling'
import { loadVenueRouteContext } from '@/features/venues'

export const Route = createFileRoute('/t/$slug/l/$venue/bloques')({
  loader: async ({ params }) => {
    const routeContext = await loadVenueRouteContext(params.slug, params.venue)
    if (!routeContext) throw notFound()
    return routeContext
  },
  component: BlocksRoute,
})

function BlocksRoute() {
  const { tenant, venue } = Route.useLoaderData()
  return <SchedulingBlocksPage tenantId={tenant.id} venueId={venue.id} />
}
