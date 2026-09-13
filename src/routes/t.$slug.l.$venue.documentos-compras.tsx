import { createFileRoute, notFound } from '@tanstack/react-router'

import { PurchaseDocumentReviewsPage } from '@/features/product'
import { requireTenantRouteAccess } from '@/features/tenancy/application/tenant-route-access'
import { loadVenueRouteContext } from '@/features/venues'
export const Route = createFileRoute('/t/$slug/l/$venue/documentos-compras')({
  beforeLoad: ({ context }) =>
    requireTenantRouteAccess(context.tenantMembership.role, 'administration'),
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    return routeContext
  },
  component: PurchaseDocumentsRoute,
})
function PurchaseDocumentsRoute() {
  const { tenant, venue } = Route.useLoaderData()
  return <PurchaseDocumentReviewsPage tenantId={tenant.id} venueId={venue.id} />
}
