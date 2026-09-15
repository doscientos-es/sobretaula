import { queryOptions, useQuery } from '@tanstack/react-query'
import { createLazyFileRoute } from '@tanstack/react-router'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import { getTimekeepingTerminalStaff } from '@/features/timekeeping'
import { TimekeepingTerminalPage } from '@/features/timekeeping/ui/timekeeping-terminal-page'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/fichaje-terminal')({
  component: TimekeepingTerminalRoute,
})

function TimekeepingTerminalRoute() {
  const { tenant, venue } = Route.useLoaderData()
  const staffQuery = useQuery(timekeepingTerminalStaffQuery(tenant.id, venue.id))
  if (staffQuery.isPending) return <TenantRoutePending />
  if (staffQuery.error) throw staffQuery.error
  return <TimekeepingTerminalPage staff={staffQuery.data} tenantId={tenant.id} venueId={venue.id} />
}

function timekeepingTerminalStaffQuery(tenantId: string, venueId: string) {
  return queryOptions({
    queryFn: () => getTimekeepingTerminalStaff({ data: { tenantId, venueId } }),
    queryKey: ['tenant', tenantId, 'venue', venueId, 'timekeeping-terminal-staff'],
    staleTime: 60_000,
  })
}
