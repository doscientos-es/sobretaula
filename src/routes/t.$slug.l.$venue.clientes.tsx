import { createFileRoute, notFound } from '@tanstack/react-router'

import { GuestsPage } from '@/features/guests'
import { loadVenueRouteContext } from '@/features/venues'

export const Route = createFileRoute('/t/$slug/l/$venue/clientes')({
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    return routeContext
  },
  component: GuestsRoute,
})

function GuestsRoute() {
  const { tenant, venue } = Route.useLoaderData()
  return <GuestsPage tenantId={tenant.id} venueId={venue.id} />
}
