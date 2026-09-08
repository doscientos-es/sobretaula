import { createFileRoute } from '@tanstack/react-router'

import { FloorPlanPage, getFloorPlan } from '@/features/floor-plan'

export const Route = createFileRoute('/t/$slug/l/$venue/plano')({
  loader: ({ context }) =>
    getFloorPlan({ data: { tenantId: context.tenant.id, venueId: context.venue.id } }),
  component: FloorPlanRoute,
})

function FloorPlanRoute() {
  const { tenant, venue } = Route.useRouteContext()
  const data = Route.useLoaderData()

  return <FloorPlanPage data={data} tenantId={tenant.id} venueId={venue.id} />
}
