import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { tenantRouteState } from '@/app/tenant-route-loader'
import {
  getReservationServices,
  getReservationTerms,
} from '@/features/reservations/application/reservations'

export const Route = createFileRoute('/t/$slug/l/$venue/reservas')({
  validateSearch: z.object({
    date: z.string().date().optional(),
    q: z.string().trim().max(100).optional(),
    status: z.enum(['all', 'pending', 'confirmed', 'seated', 'cancelled', 'no_show']).optional(),
  }),
  loader: async ({ context }) => {
    const { tenant, venue } = context
    const data = { tenantId: tenant.id, venueId: venue.id }
    const [services, terms] = await Promise.all([
      getReservationServices({ data }),
      getReservationTerms({ data }),
    ])
    return { services, terms, tenant, venue }
  },
  ...tenantRouteState,
})
