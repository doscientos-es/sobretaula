import { useQueries } from '@tanstack/react-query'
import { createLazyFileRoute } from '@tanstack/react-router'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import { floorPlanQuery, type FloorPlanData } from '@/features/floor-plan'
import { ServicePage, serviceBoardQuery } from '@/features/service'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/servicio')({
  component: ServiceRoute,
})

function ServiceRoute() {
  const { tenant, venue } = Route.useLoaderData()
  const { slug: tenantSlug, venue: venueSlug } = Route.useParams()
  const [boardQuery, planQuery] = useQueries({
    queries: [serviceBoardQuery(tenant.id, venue.id), floorPlanQuery(tenant.id, venue.id)],
  })
  if (boardQuery.isPending) return <TenantRoutePending />
  if (boardQuery.error) throw boardQuery.error
  const plan: FloorPlanData = planQuery.data ?? {
    areas: [],
    elements: [],
    placements: [],
  }
  return (
    <ServicePage
      board={boardQuery.data}
      plan={plan}
      tenantId={tenant.id}
      venueId={venue.id}
      tenantSlug={tenantSlug}
      venueSlug={venueSlug}
    />
  )
}
