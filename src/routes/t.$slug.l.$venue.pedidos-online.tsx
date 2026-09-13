import { createFileRoute, notFound } from '@tanstack/react-router'

import { OnlineOrdersPage } from '@/features/online-ordering'
import { loadVenueRouteContext } from '@/features/venues'
export const Route = createFileRoute('/t/$slug/l/$venue/pedidos-online')({
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    return routeContext
  },
  component: OnlineOrdersRoute,
})
function OnlineOrdersRoute() {
  const { tenant, venue } = Route.useLoaderData()
  return <OnlineOrdersPage tenantId={tenant.id} venueId={venue.id} />
}
