import { createFileRoute } from '@tanstack/react-router'

import {
  getReservationServices,
  getReservationTerms,
  ReservationPage,
} from '@/features/reservations'

export const Route = createFileRoute('/t/$slug/l/$venue/reservas')({
  loader: async ({ context }) => {
    const data = { tenantId: context.tenant.id, venueId: context.venue.id }
    const [services, terms] = await Promise.all([
      getReservationServices({ data }),
      getReservationTerms({ data }),
    ])
    return { services, terms }
  },
  component: ReservationsRoute,
})

function ReservationsRoute() {
  const { tenant, venue } = Route.useRouteContext()
  const { services, terms } = Route.useLoaderData()

  return (
    <ReservationPage
      locale={tenant.defaultLocale}
      services={services}
      tenantId={tenant.id}
      timezone={tenant.timezone}
      venueId={venue.id}
      terms={terms}
    />
  )
}
