import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { createLazyFileRoute } from '@tanstack/react-router'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import { getTipsOverview } from '@/features/tips'
import { TipsPage } from '@/features/tips/ui/tips-page'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/propinas')({ component: TipsRoute })

function TipsRoute() {
  const { tenant, venue } = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const search = Route.useSearch()
  const reload = useLoaderReload()
  const overviewQuery = useQuery({
    ...tipsOverviewQuery(tenant.id, venue.id, search.page),
    placeholderData: keepPreviousData,
  })
  if (overviewQuery.isPending) return <TenantRoutePending />
  if (overviewQuery.error) throw overviewQuery.error
  return (
    <TipsPage
      onDone={() => void reload()}
      overview={overviewQuery.data}
      tenantId={tenant.id}
      venueId={venue.id}
      onPageChange={(page) => void navigate({ search: (current) => ({ ...current, page }) })}
    />
  )
}

function tipsOverviewQuery(tenantId: string, venueId: string, page: number) {
  return queryOptions({
    queryFn: () => getTipsOverview({ data: { tenantId, venueId, page, pageSize: 25 } }),
    queryKey: ['tenant', tenantId, 'venue', venueId, 'tips-overview', page],
    staleTime: 30_000,
  })
}
