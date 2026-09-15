import { createFileRoute } from '@tanstack/react-router'

import { GiftCardsPage } from '@/features/gift-cards'
import { requireTenantRouteAccess } from '@/features/tenancy/application/tenant-route-access'
export const Route = createFileRoute('/t/$slug/l/$venue/tarjetas-regalo')({
  beforeLoad: ({ context }) =>
    requireTenantRouteAccess(context.tenantMembership.role, 'administration'),
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
  component: GiftCardsRoute,
})
function GiftCardsRoute() {
  const { tenant } = Route.useLoaderData()
  return <GiftCardsPage tenantId={tenant.id} />
}
