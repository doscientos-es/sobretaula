import { useQuery } from '@tanstack/react-query'
import { createLazyFileRoute, getRouteApi } from '@tanstack/react-router'

import { dashboardMetricsQuery, tenantSetupStatusQuery, TenantHomePage } from '@/features/tenancy'

export const Route = createLazyFileRoute('/t/$slug/')({
  component: TenantHomeRoute,
})

const tenantRoute = getRouteApi('/t/$slug')

function TenantHomeRoute() {
  const { tenant, venues } = tenantRoute.useLoaderData()
  const venueIds = venues.map((venue) => venue.id)
  const metrics = useQuery(dashboardMetricsQuery(tenant.id, venueIds, tenant.timezone))
  const setupStatus = useQuery(tenantSetupStatusQuery(tenant.id, venueIds))

  if (metrics.isPending || setupStatus.isPending) return <TenantHomeSkeleton />
  if (metrics.error) throw metrics.error
  if (setupStatus.error) throw setupStatus.error
  // A query can briefly leave the pending state while its data is still
  // unavailable during hydration/refetch. Never render the dashboard with a
  // partial snapshot: keep the useful shell visible until both payloads exist.
  if (!metrics.data || !setupStatus.data) return <TenantHomeSkeleton />

  return (
    <TenantHomePage
      metrics={metrics.data}
      setupStatus={setupStatus.data}
      tenant={tenant}
      venues={venues}
    />
  )
}

function TenantHomeSkeleton() {
  return (
    <section aria-busy="true" aria-label="Cargando resumen del restaurante" className="space-y-7">
      <div className="border-border/70 space-y-3 border-b pb-6">
        <div className="bg-muted h-8 w-56 animate-pulse rounded-lg" />
        <div className="bg-muted h-4 w-80 max-w-full animate-pulse rounded" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="border-border/70 space-y-4 rounded-xl border p-5" key={index}>
            <div className="bg-muted h-4 w-28 animate-pulse rounded" />
            <div className="bg-muted h-9 w-20 animate-pulse rounded" />
            <div className="bg-muted h-3 w-36 animate-pulse rounded" />
          </div>
        ))}
      </div>
      <div className="border-border/70 space-y-4 rounded-xl border p-6">
        <div className="bg-muted h-5 w-44 animate-pulse rounded" />
        <div className="bg-muted h-16 w-full animate-pulse rounded-lg" />
      </div>
      <div className="border-border/70 space-y-4 rounded-xl border p-6">
        <div className="bg-muted h-5 w-36 animate-pulse rounded" />
        <div className="bg-muted h-14 w-full animate-pulse rounded-lg" />
      </div>
    </section>
  )
}
