import { queryOptions, useQuery } from '@tanstack/react-query'
import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { TenantRoutePending, tenantRouteState } from '@/app/tenant-route-loader'
import { getTenantTeam, requireTenantRouteAccess, TenantTeamPage } from '@/features/tenancy'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/equipo')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  loader: ({ context }) => ({ tenant: context.tenant }),
  component: TenantTeamRoute,
  ...tenantRouteState,
})

function TenantTeamRoute() {
  const { tenant, membership } = tenantRoute.useLoaderData()
  const teamQuery = useQuery(tenantTeamQuery(tenant.id))
  if (teamQuery.isPending) return <TenantRoutePending />
  if (teamQuery.error) throw teamQuery.error
  return (
    <TenantTeamPage
      team={teamQuery.data}
      tenantId={tenant.id}
      viewerId={membership.userId}
      viewerRole={membership.role}
    />
  )
}

function tenantTeamQuery(tenantId: string) {
  return queryOptions({
    queryFn: () => getTenantTeam({ data: { tenantId } }),
    queryKey: ['tenant', tenantId, 'team'],
    staleTime: 30_000,
  })
}
