import { createFileRoute, notFound } from '@tanstack/react-router'

import { GiftCardsPage } from '@/features/gift-cards'
import { loadVenueRouteContext } from '@/features/venues'
export const Route = createFileRoute('/t/$slug/l/$venue/tarjetas-regalo')({
  loader: async ({ params }) => {
    const context = await loadVenueRouteContext(params.slug, params.venue)
    if (!context) throw notFound()
    return context
  },
  component: GiftCardsRoute,
})
function GiftCardsRoute() {
  const { tenant } = Route.useLoaderData()
  return <GiftCardsPage tenantId={tenant.id} />
}
