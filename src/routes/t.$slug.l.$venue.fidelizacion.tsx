import { createFileRoute } from '@tanstack/react-router'

import { LoyaltyPage } from '@/features/loyalty'
import { requireTenantRouteAccess } from '@/features/tenancy/application/tenant-route-access'

export const Route = createFileRoute('/t/$slug/l/$venue/fidelizacion')({
  beforeLoad: ({ context }) =>
    requireTenantRouteAccess(context.tenantMembership.role, 'administration'),
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
  component: LoyaltyRoute,
})

function LoyaltyRoute() {
  const { tenant } = Route.useLoaderData()
  return <LoyaltyPage tenantId={tenant.id} />
}
