import { createFileRoute, notFound } from '@tanstack/react-router'

import { getRestaurantLegalIdentity, LegalPage } from '@/features/legal'
import { getPublicReservationProfile } from '@/features/public-reservations'

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
  return <LegalPage document="booking-privacy" identity={identity} restaurantName={profile.name} />
}
