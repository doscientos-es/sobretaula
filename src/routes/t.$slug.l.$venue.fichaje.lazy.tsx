import { useQuery } from '@tanstack/react-query'
import { createLazyFileRoute } from '@tanstack/react-router'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import { TimekeepingPage } from '@/features/timekeeping/ui/timekeeping-page'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

import { timekeepingManagementQuery, timekeepingSummaryQuery } from './t.$slug.l.$venue.fichaje'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/fichaje')({
  component: TimekeepingRoute,
})

function TimekeepingRoute() {
  const { tenantMembership } = Route.useRouteContext()
  const { tenant, venue } = Route.useLoaderData()
  const summaryQuery = useQuery(timekeepingSummaryQuery(tenant.id, venue.id))
  const managementQuery = useQuery({
    ...timekeepingManagementQuery(tenant.id, venue.id),
    enabled: tenantMembership.role === 'owner' || tenantMembership.role === 'manager',
  })
  const reload = useLoaderReload()
  const canManage = tenantMembership.role === 'owner' || tenantMembership.role === 'manager'
  if (summaryQuery.isPending || (canManage && managementQuery.isPending))
    return <TenantRoutePending />
  if (summaryQuery.error) throw summaryQuery.error
  if (canManage && managementQuery.error) throw managementQuery.error
  return (
    <TimekeepingPage
      summary={summaryQuery.data}
      management={managementQuery.data ?? null}
      employeeId={tenantMembership.userId}
      tenantId={tenant.id}
      venueId={venue.id}
      onDone={reload}
    />
  )
}
