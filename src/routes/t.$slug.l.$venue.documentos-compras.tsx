import { createFileRoute } from '@tanstack/react-router'

import { PurchaseDocumentReviewsPage } from '@/features/product'
import { requireTenantRouteAccess } from '@/features/tenancy/application/tenant-route-access'
export const Route = createFileRoute('/t/$slug/l/$venue/documentos-compras')({
  beforeLoad: ({ context }) =>
    requireTenantRouteAccess(context.tenantMembership.role, 'administration'),
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
  component: PurchaseDocumentsRoute,
})
function PurchaseDocumentsRoute() {
  const { tenant, venue } = Route.useLoaderData()
  return <PurchaseDocumentReviewsPage tenantId={tenant.id} venueId={venue.id} />
}
