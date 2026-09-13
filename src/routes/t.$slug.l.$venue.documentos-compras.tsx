import { createFileRoute, notFound } from '@tanstack/react-router'

import { PurchaseDocumentReviewsPage } from '@/features/product'
import { loadVenueRouteContext } from '@/features/venues'
export const Route = createFileRoute('/t/$slug/l/$venue/documentos-compras')({
  loader: async ({ params }) => {
    const context = await loadVenueRouteContext(params.slug, params.venue)
    if (!context) throw notFound()
    return context
  },
  component: PurchaseDocumentsRoute,
})
function PurchaseDocumentsRoute() {
  const { tenant, venue } = Route.useLoaderData()
  return <PurchaseDocumentReviewsPage tenantId={tenant.id} venueId={venue.id} />
}
