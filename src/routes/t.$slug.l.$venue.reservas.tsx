import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { tenantRouteState } from '@/app/tenant-route-loader'
import {
  getReservationServices,
  getReservationTerms,
  type ReservationAgendaSearch,
} from '@/features/reservations'
import { loadVenueRouteContext } from '@/features/venues'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

export const Route = createFileRoute('/t/$slug/l/$venue/reservas')({
  validateSearch: z.object({
    date: z.string().date().optional(),
    q: z.string().trim().max(100).optional(),
    status: z.enum(['all', 'pending', 'confirmed', 'seated', 'cancelled', 'no_show']).optional(),
  }),
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    const { tenant, venue } = routeContext
    const data = { tenantId: tenant.id, venueId: venue.id }
    const [services, terms] = await Promise.all([
      getReservationServices({ data }),
      getReservationTerms({ data }),
    ])
    return { services, terms, tenant, venue }
  },
  ...tenantRouteState,
})
