import { createFileRoute, notFound } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import {
  getReservationServices,
  getReservationTerms,
  ReservationPage,
} from '@/features/reservations'
import { loadVenueRouteContext } from '@/features/venues'
import { useLocale } from '@/shared/lib/i18n/locale-preference'

export const Route = createFileRoute('/t/$slug/l/$venue/reservas')({
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

  return (
    <ReservationPage
      locale={locale}
      services={services}
      tenantId={tenant.id}
      timezone={tenant.timezone}
      venueId={venue.id}
      terms={terms}
    />
  )
}
