import { createLazyFileRoute } from '@tanstack/react-router'

import { FloorPlanPage } from '@/features/floor-plan'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/plano')({
  component: FloorPlanRoute,
})

function FloorPlanRoute() {
  const { data, tenant, venue } = Route.useLoaderData()

  return <FloorPlanPage data={data} tenantId={tenant.id} venueId={venue.id} />
}
