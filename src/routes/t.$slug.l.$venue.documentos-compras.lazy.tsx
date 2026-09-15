import { createLazyFileRoute } from '@tanstack/react-router'

import { PurchaseDocumentReviewsPage } from '@/features/product'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/documentos-compras')({
  component: PurchaseDocumentsRoute,
})

function PurchaseDocumentsRoute() {
  const { tenant, venue } = Route.useLoaderData()
  return <PurchaseDocumentReviewsPage tenantId={tenant.id} venueId={venue.id} />
}
