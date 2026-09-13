import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { tenantRouteState } from '@/app/tenant-route-loader'
import {
  getReservationServices,
  getReservationTerms,
  ReservationPage,
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
  component: ReservationsRoute,
  ...tenantRouteState,
})

function ReservationsRoute() {
  const { services, terms, tenant, venue } = Route.useLoaderData()
  const locale = useLocale(tenant.defaultLocale)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const agendaSearch: ReservationAgendaSearch = {
    ...(search.date ? { date: search.date } : {}),
    ...(search.q ? { query: search.q } : {}),
    ...(search.status ? { status: search.status } : {}),
  }

  return (
    <ReservationPage
      agendaSearch={agendaSearch}
      locale={locale}
      onAgendaSearchChange={(next) =>
        void navigate({
          search: {
            date: next.date,
            q: next.query || undefined,
            status: next.status === 'all' ? undefined : next.status,
          },
        })
      }
      services={services}
      tenantId={tenant.id}
      timezone={tenant.timezone}
      venueId={venue.id}
      terms={terms}
    />
  )
}
