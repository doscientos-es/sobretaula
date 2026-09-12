import { createFileRoute, notFound } from '@tanstack/react-router'

import { getPublicReservationProfile, PublicReservationPage } from '@/features/public-reservations'
import { LocaleProvider, PUBLIC_LOCALE_STORAGE_KEY } from '@/shared/lib/i18n/locale-preference'

export const Route = createFileRoute('/reservar/$slug')({
  loader: ({ params }) => getPublicReservationProfile({ data: { slug: params.slug } }),
  component: PublicBookingRoute,
})

function PublicBookingRoute() {
  const profile = Route.useLoaderData()
  if (!profile) throw notFound()
  return (
    <LocaleProvider browserDefault storageKey={PUBLIC_LOCALE_STORAGE_KEY}>
      <PublicReservationPage profile={profile} />
    </LocaleProvider>
  )
}
