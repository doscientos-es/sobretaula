import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { requireTenantRouteAccess } from '@/features/tenancy/application/tenant-route-access'

export const Route = createFileRoute('/t/$slug/l/$venue/tpv')({
  validateSearch: z.object({ sessionId: z.string().uuid().optional() }),
  loaderDeps: ({ search }) => ({ sessionId: search.sessionId }),
  beforeLoad: ({ context }) =>
    requireTenantRouteAccess(context.tenantMembership.role, 'operations'),
  loader: async ({ context, deps }) => {
    const { tenant, venue } = context
    return {
      tenant,
      venue,
      sessionId: deps.sessionId,
    }
  },
  ...tenantRouteState,
})
