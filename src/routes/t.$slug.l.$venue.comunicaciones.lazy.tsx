import { createLazyFileRoute } from '@tanstack/react-router'

import { CampaignsPage } from '@/features/guests'
import { NotificationJobsPage } from '@/features/notifications'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/comunicaciones')({
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
