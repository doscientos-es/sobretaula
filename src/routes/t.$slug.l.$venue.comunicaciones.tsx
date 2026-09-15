import { createFileRoute } from '@tanstack/react-router'

import { CampaignsPage } from '@/features/guests'
import { NotificationJobsPage } from '@/features/notifications'

export const Route = createFileRoute('/t/$slug/l/$venue/comunicaciones')({
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
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
