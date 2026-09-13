import { createFileRoute, notFound } from '@tanstack/react-router'

import { LoyaltyPage } from '@/features/loyalty'
import { loadVenueRouteContext } from '@/features/venues'

export const Route = createFileRoute('/t/$slug/l/$venue/fidelizacion')({
  loader: async ({ params }) => {
    const context = await loadVenueRouteContext(params.slug, params.venue)
    if (!context) throw notFound()
    return context
  },
  component: LoyaltyRoute,
})

function LoyaltyRoute() {
  const { tenant } = Route.useLoaderData()
  return <LoyaltyPage tenantId={tenant.id} />
}
