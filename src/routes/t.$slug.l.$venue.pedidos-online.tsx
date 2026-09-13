import { createFileRoute, notFound } from '@tanstack/react-router'

import { OnlineOrdersPage } from '@/features/online-ordering'
import { loadVenueRouteContext } from '@/features/venues'
export const Route = createFileRoute('/t/$slug/l/$venue/pedidos-online')({
  loader: async ({ params }) => {
    const context = await loadVenueRouteContext(params.slug, params.venue)
    if (!context) throw notFound()
    return context
  },
  component: OnlineOrdersRoute,
})
function OnlineOrdersRoute() {
  const { tenant, venue } = Route.useLoaderData()
  return <OnlineOrdersPage tenantId={tenant.id} venueId={venue.id} />
}
