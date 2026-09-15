import { useQuery } from '@tanstack/react-query'
import { createLazyFileRoute } from '@tanstack/react-router'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import { FloorPlanPage, floorPlanQuery } from '@/features/floor-plan'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/plano')({
  component: FloorPlanRoute,
})

function FloorPlanRoute() {
  const { tenant, venue } = Route.useLoaderData()
  const plan = useQuery(floorPlanQuery(tenant.id, venue.id))
  if (plan.isPending) return <TenantRoutePending />
  if (plan.error) throw plan.error

  return <FloorPlanPage data={plan.data} tenantId={tenant.id} venueId={venue.id} />
}
