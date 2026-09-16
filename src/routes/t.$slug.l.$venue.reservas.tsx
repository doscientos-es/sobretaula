import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { tenantRouteState } from '@/app/tenant-route-loader'

export const Route = createFileRoute('/t/$slug/l/$venue/reservas')({
  validateSearch: z.object({
    date: z.string().date().optional(),
    q: z.string().trim().max(100).optional(),
    status: z.enum(['all', 'pending', 'confirmed', 'seated', 'cancelled', 'no_show']).optional(),
    section: z.enum(['agenda', 'turnos']).optional(),
  }),
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
  ...tenantRouteState,
})
