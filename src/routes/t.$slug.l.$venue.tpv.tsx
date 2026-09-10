import { createFileRoute } from '@tanstack/react-router'

import { PosTerminalPage } from '@/features/pos'
import { getServiceBoard } from '@/features/service'
import { requireTenantRouteAccess } from '@/features/tenancy/application/tenant-route-access'

export const Route = createFileRoute('/t/$slug/l/$venue/tpv')({
  beforeLoad: ({ context }) =>
    requireTenantRouteAccess(context.tenantMembership.role, 'operations'),
  loader: ({ context }) =>
    getServiceBoard({ data: { tenantId: context.tenant.id, venueId: context.venue.id } }),
  component: PosTerminalRoute,
})

function PosTerminalRoute() {
  const { tenantMembership, venue } = Route.useRouteContext()
  return (
    <PosTerminalPage
      board={Route.useLoaderData()}
      canAccessAccounts={tenantMembership.role !== 'host'}
      slug={Route.useParams().slug}
      venue={venue.slug}
    />
  )
}
