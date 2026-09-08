import { createFileRoute, getRouteApi, notFound } from '@tanstack/react-router'

import { getFloorPlan } from '@/features/floor-plan'
import { getReservationServices, ReservationPage } from '@/features/reservations'
import { getTenantBySlug } from '@/features/tenancy'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/reservas')({
  loader: async ({ params }) => {
    const tenant = await getTenantBySlug({ data: { slug: params.slug } })
    if (!tenant) throw notFound()
    const [services, floorPlan] = await Promise.all([
      getReservationServices({ data: { tenantId: tenant.id } }),
      getFloorPlan({ data: { tenantId: tenant.id } }),
    ])
    return { floorPlan, services }
  },
  component: ReservationsRoute,
})

function ReservationsRoute() {
  const { tenant } = tenantRoute.useLoaderData()
  const { floorPlan, services } = Route.useLoaderData()

  return (
    <ReservationPage
      services={services}
      tenantId={tenant.id}
      venueId={floorPlan.areas[0]?.venueId}
    />
  )
}
