import { createFileRoute } from '@tanstack/react-router'

import { SchedulingBlocksPage } from '@/features/scheduling'
export const Route = createFileRoute('/t/$slug/l/$venue/bloques')({ component: BlocksRoute })
function BlocksRoute() {
  const { tenant, venue } = Route.useRouteContext()
  return <SchedulingBlocksPage tenantId={tenant.id} venueId={venue.id} />
}
