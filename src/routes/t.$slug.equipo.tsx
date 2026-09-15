import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { tenantRouteState } from '@/app/tenant-route-loader'
import { getTenantTeam, requireTenantRouteAccess, TenantTeamPage } from '@/features/tenancy'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/equipo')({
  beforeLoad: ({ context }) => {
    requireTenantRouteAccess(context.tenantMembership.role, 'administration')
  },
  loader: async ({ context }) => {
    const { tenant } = context
    return getTenantTeam({ data: { tenantId: tenant.id } })
  },
  component: TenantTeamRoute,
  ...tenantRouteState,
})

function TenantTeamRoute() {
  const { tenant, membership } = tenantRoute.useLoaderData()
  return (
    <TenantTeamPage
      team={Route.useLoaderData()}
      tenantId={tenant.id}
      viewerId={membership.userId}
      viewerRole={membership.role}
    />
  )
}
