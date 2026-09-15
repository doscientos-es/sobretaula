import { createFileRoute } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { getMyTimekeeping, getTimekeepingConfiguration } from '@/features/timekeeping'
export const Route = createFileRoute('/t/$slug/l/$venue/fichaje')({
  loader: ({ context }) => ({ tenant: context.tenant, venue: context.venue }),
  ...tenantRouteState,
})

export function timekeepingSummaryQuery(tenantId: string, venueId: string) {
  return {
    queryFn: () => getMyTimekeeping({ data: { tenantId, venueId } }),
    queryKey: ['tenant', tenantId, 'venue', venueId, 'timekeeping-summary'],
    staleTime: 15_000,
  }
}

export function timekeepingManagementQuery(tenantId: string, venueId: string) {
  return {
    queryFn: () => getTimekeepingConfiguration({ data: { tenantId, venueId } }),
    queryKey: ['tenant', tenantId, 'venue', venueId, 'timekeeping-management'],
    staleTime: 60_000,
  }
}
