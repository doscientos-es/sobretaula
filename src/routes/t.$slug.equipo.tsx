import { createFileRoute, getRouteApi } from '@tanstack/react-router'

import { getTenantTeam, TenantTeamPage, tenantBySlugQuery } from '@/features/tenancy'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/equipo')({
  loader: async ({ context, params }) => {
    const tenant = await context.queryClient.ensureQueryData(tenantBySlugQuery(params.slug))
    if (!tenant) throw new Response('Not Found', { status: 404 })
    return getTenantTeam({ data: { tenantId: tenant.id } })
  },
  component: TenantTeamRoute,
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
