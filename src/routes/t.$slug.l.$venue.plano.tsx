import { createFileRoute } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { getFloorPlan } from '@/features/floor-plan/application/floor-plan'
import { requireTenantRouteAccess } from '@/features/tenancy/application/tenant-route-access'

export const Route = createFileRoute('/t/$slug/l/$venue/plano')({
  beforeLoad: ({ context }) =>
    requireTenantRouteAccess(context.tenantMembership.role, 'venue_management'),
  loader: async ({ context }) => {
    const { tenant, venue } = context
    return {
      data: await getFloorPlan({ data: { tenantId: tenant.id, venueId: venue.id } }),
      tenant,
      venue,
    }
  },
  ...tenantRouteState,
})
