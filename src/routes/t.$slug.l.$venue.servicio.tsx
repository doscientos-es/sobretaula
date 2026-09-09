import { createFileRoute } from '@tanstack/react-router'

import { getFloorPlan } from '@/features/floor-plan'
import { getServiceBoard, ServicePage } from '@/features/service'

export const Route = createFileRoute('/t/$slug/l/$venue/servicio')({
  loader: async ({ context }) => {
    const data = { tenantId: context.tenant.id, venueId: context.venue.id }
    const [board, plan] = await Promise.all([getServiceBoard({ data }), getFloorPlan({ data })])

    return { board, plan }
  },
  component: ServiceRoute,
})

function ServiceRoute() {
  const { tenant, venue } = Route.useRouteContext()
  const { board, plan } = Route.useLoaderData()

  return <ServicePage board={board} plan={plan} tenantId={tenant.id} venueId={venue.id} />
}
