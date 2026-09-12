import { createFileRoute, notFound } from '@tanstack/react-router'

import {
  getPublicReservation,
  PublicReservationManagementPage,
} from '@/features/public-reservations'
import { LocaleProvider, PUBLIC_LOCALE_STORAGE_KEY } from '@/shared/lib/i18n/locale-preference'

export const Route = createFileRoute('/reserva/$token')({
  loader: ({ params }) => getPublicReservation({ data: { token: params.token } }),
  component: ReservationManagementRoute,
})

function ReservationManagementRoute() {
  const reservation = Route.useLoaderData()
  if (!reservation) throw notFound()
  return (
    <LocaleProvider browserDefault storageKey={PUBLIC_LOCALE_STORAGE_KEY}>
      <PublicReservationManagementPage reservation={reservation} token={Route.useParams().token} />
    </LocaleProvider>
  )
}
