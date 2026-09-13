import { createFileRoute, notFound } from '@tanstack/react-router'

import { LoyaltyPage } from '@/features/loyalty'
import { requireTenantRouteAccess } from '@/features/tenancy/application/tenant-route-access'
import { loadVenueRouteContext } from '@/features/venues'

export const Route = createFileRoute('/t/$slug/l/$venue/fidelizacion')({
  beforeLoad: ({ context }) =>
    requireTenantRouteAccess(context.tenantMembership.role, 'administration'),
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    return routeContext
  },
  component: LoyaltyRoute,
})

function LoyaltyRoute() {
  const { tenant } = Route.useLoaderData()
  return <LoyaltyPage tenantId={tenant.id} />
}
