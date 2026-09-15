import { createFileRoute } from '@tanstack/react-router'

import { requireTenantRouteAccess } from '@/features/tenancy/application/tenant-route-access'

export const Route = createFileRoute('/t/$slug/l/$venue/fidelizacion')({
  beforeLoad: ({ context }) =>
    requireTenantRouteAccess(context.tenantMembership.role, 'administration'),
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
})
