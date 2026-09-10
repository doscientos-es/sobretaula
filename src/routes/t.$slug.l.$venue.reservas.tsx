import { createFileRoute } from '@tanstack/react-router'

import { getReservationServices, ReservationPage } from '@/features/reservations'

export const Route = createFileRoute('/t/$slug/l/$venue/reservas')({
  loader: ({ context }) =>
    getReservationServices({ data: { tenantId: context.tenant.id, venueId: context.venue.id } }),
  component: ReservationsRoute,
})

function ReservationsRoute() {
  const { tenant, venue } = Route.useRouteContext()
  const services = Route.useLoaderData()

  return (
    <ReservationPage
      locale={tenant.defaultLocale}
      services={services}
      tenantId={tenant.id}
      venueId={venue.id}
    />
  )
}
