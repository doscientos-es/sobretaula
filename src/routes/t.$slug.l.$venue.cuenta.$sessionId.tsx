import { createFileRoute } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { requireTenantRouteAccess } from '@/features/tenancy'

export const Route = createFileRoute('/t/$slug/l/$venue/cuenta/$sessionId')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'table_account')
  },
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
  ...tenantRouteState,
})
