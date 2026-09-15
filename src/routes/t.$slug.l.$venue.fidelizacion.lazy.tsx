import { createLazyFileRoute } from '@tanstack/react-router'

import { LoyaltyPage } from '@/features/loyalty'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/fidelizacion')({
  component: LoyaltyRoute,
})

function LoyaltyRoute() {
  const { tenant } = Route.useLoaderData()
  return <LoyaltyPage tenantId={tenant.id} />
}
