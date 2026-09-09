import { createFileRoute, notFound } from '@tanstack/react-router'

import { getPublicReservationProfile, PublicReservationPage } from '@/features/public-reservations'

export const Route = createFileRoute('/reservar/$slug')({
  loader: ({ params }) => getPublicReservationProfile({ data: { slug: params.slug } }),
  component: PublicBookingRoute,
})

function PublicBookingRoute() {
  const profile = Route.useLoaderData()
  if (!profile) throw notFound()
  return <PublicReservationPage profile={profile} />
}
