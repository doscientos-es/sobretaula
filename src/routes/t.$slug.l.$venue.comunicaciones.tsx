import { createFileRoute, notFound } from '@tanstack/react-router'

import { CampaignsPage } from '@/features/guests'
import { NotificationJobsPage } from '@/features/notifications'
import { loadVenueRouteContext } from '@/features/venues'

export const Route = createFileRoute('/t/$slug/l/$venue/comunicaciones')({
  loader: async ({ context, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    return routeContext
  },
  component: CommunicationsRoute,
})

function CommunicationsRoute() {
  const { tenant } = Route.useLoaderData()
  return (
    <div className="space-y-6">
      <CampaignsPage tenantId={tenant.id} />
      <NotificationJobsPage tenantId={tenant.id} />
    </div>
  )
}
