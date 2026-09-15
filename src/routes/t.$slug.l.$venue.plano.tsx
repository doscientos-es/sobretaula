import { createFileRoute } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { requireTenantRouteAccess } from '@/features/tenancy/application/tenant-route-access'

export const Route = createFileRoute('/t/$slug/l/$venue/plano')({
  beforeLoad: ({ context }) =>
    requireTenantRouteAccess(context.tenantMembership.role, 'venue_management'),
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
  ...tenantRouteState,
})
