import { createFileRoute } from '@tanstack/react-router'

import {
  getPublicReservation,
  PublicReservationManagementPage,
} from '@/features/public-reservations'
import { LocaleProvider, PUBLIC_LOCALE_STORAGE_KEY } from '@/shared/lib/i18n/locale-preference'

export const Route = createFileRoute('/reserva/$token')({
  headers: () => ({ 'Cache-Control': 'no-store' }),
  loader: ({ params }) => getPublicReservation({ data: { token: params.token } }),
  component: ReservationManagementRoute,
  notFoundComponent: ReservationNotFound,
})

function ReservationManagementRoute() {
  const token = Route.useParams().token
  const reservation = Route.useLoaderData()
  if (!reservation) return <ReservationNotFound />
  return (
    <LocaleProvider browserDefault storageKey={PUBLIC_LOCALE_STORAGE_KEY}>
      <PublicReservationManagementPage reservation={reservation} token={token} />
    </LocaleProvider>
  )
}

function ReservationNotFound() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-[#fbfaf8] p-6">
      <section className="w-full max-w-md rounded-3xl border border-[#292d34]/10 bg-white p-8 text-center shadow-[0_1.5rem_4rem_rgb(66_48_35_/_12%)]">
        <h1 className="text-2xl font-semibold text-[#292d34]">Reserva no encontrada</h1>
        <p className="mt-3 text-sm leading-6 text-[#60656d]">
          Este enlace ha caducado o no corresponde a una reserva activa. Puedes volver al inicio
          para hacer una nueva reserva.
        </p>
        <a
          className="mt-6 inline-flex rounded-md bg-[#c34d3e] px-4 py-2 text-sm font-semibold text-white underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c34d3e]"
          href="/"
        >
          Volver al inicio
        </a>
      </section>
    </main>
  )
}
