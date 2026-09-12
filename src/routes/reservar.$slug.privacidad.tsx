import { createFileRoute, notFound } from '@tanstack/react-router'

import { getRestaurantLegalIdentity, LegalPage } from '@/features/legal'
import { getPublicReservationProfile } from '@/features/public-reservations'
import {
  LocaleProvider,
  PUBLIC_LOCALE_STORAGE_KEY,
} from '@/shared/lib/i18n/locale-preference'

export const Route = createFileRoute('/reservar/$slug/privacidad')({
  loader: async ({ params }) => {
    const [profile, identity] = await Promise.all([
      getPublicReservationProfile({ data: { slug: params.slug } }),
      getRestaurantLegalIdentity({ data: { slug: params.slug } }),
    ])
    if (!profile) throw notFound()
    return { identity, profile }
  },
  component: BookingPrivacyRoute,
})

function BookingPrivacyRoute() {
  const { identity, profile } = Route.useLoaderData()
  return (
    <LocaleProvider browserDefault storageKey={PUBLIC_LOCALE_STORAGE_KEY}>
      <LegalPage document="booking-privacy" identity={identity} restaurantName={profile.name} />
    </LocaleProvider>
  )
}
