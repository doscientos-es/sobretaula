import { createFileRoute, notFound } from '@tanstack/react-router'

import { getPublicReservation, PublicReservationManagementPage } from '@/features/public-reservations'

export const Route = createFileRoute('/reserva/$token')({
  loader: ({ params }) => getPublicReservation({ data: { token: params.token } }),
  component: ReservationManagementRoute,
})

function ReservationManagementRoute() {
  const reservation = Route.useLoaderData()
  if (!reservation) throw notFound()
  return <PublicReservationManagementPage reservation={reservation} token={Route.useParams().token} />
}
