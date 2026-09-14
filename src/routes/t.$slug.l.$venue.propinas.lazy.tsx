import { createLazyFileRoute } from '@tanstack/react-router'

import { TipsPage } from '@/features/tips/ui/tips-page'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/propinas')({ component: TipsRoute })

function TipsRoute() {
  const { overview, tenant, venue } = Route.useLoaderData()
  const navigate = Route.useNavigate()
  return (
    <TipsPage
      onDone={useLoaderReload()}
      overview={overview}
      tenantId={tenant.id}
      venueId={venue.id}
      onPageChange={(page) => void navigate({ search: (current) => ({ ...current, page }) })}
    />
  )
}
