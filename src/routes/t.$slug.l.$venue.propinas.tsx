import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { getTipsOverview } from '@/features/tips'
import { TipsPage } from '@/features/tips/ui/tips-page'
import { loadVenueRouteContext } from '@/features/venues'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

export const Route = createFileRoute('/t/$slug/l/$venue/propinas')({
  validateSearch: z.object({ page: z.number().int().min(1).default(1) }),
  loaderDeps: ({ search }) => ({ page: search.page }),
  loader: async ({ params, deps }) => {
    const routeContext = await loadVenueRouteContext(params.slug, params.venue)
    if (!routeContext) throw notFound()
    const { tenant, venue } = routeContext
    return {
      overview: await getTipsOverview({
        data: { tenantId: tenant.id, venueId: venue.id, page: deps.page, pageSize: 25 },
      }),
      tenant,
      venue,
    }
  },
  component: TipsRoute,
})

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
