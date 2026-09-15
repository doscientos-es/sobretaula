import { createLazyFileRoute } from '@tanstack/react-router'

import { GiftCardsPage } from '@/features/gift-cards'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/tarjetas-regalo')({
  component: GiftCardsRoute,
})

function GiftCardsRoute() {
  const { tenant } = Route.useLoaderData()
  return <GiftCardsPage tenantId={tenant.id} />
}
