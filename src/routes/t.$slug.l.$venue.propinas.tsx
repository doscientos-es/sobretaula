import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { tenantRouteState } from '@/app/tenant-route-loader'

export const Route = createFileRoute('/t/$slug/l/$venue/propinas')({
  validateSearch: z.object({ page: z.number().int().min(1).default(1) }),
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
  ...tenantRouteState,
})
