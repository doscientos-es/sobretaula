import { createFileRoute, getRouteApi, notFound } from '@tanstack/react-router'

import { FloorPlanPage, getFloorPlan } from '@/features/floor-plan'
import { getTenantBySlug } from '@/features/tenancy'

const tenantRoute = getRouteApi('/t/$slug')

export const Route = createFileRoute('/t/$slug/plano')({
  loader: async ({ params }) => {
    const tenant = await getTenantBySlug({ data: { slug: params.slug } })
    if (!tenant) throw notFound()
    return getFloorPlan({ data: { tenantId: tenant.id } })
  },
  component: FloorPlanRoute,
})

function FloorPlanRoute() {
  const { tenant } = tenantRoute.useLoaderData()
  const data = Route.useLoaderData()

  return <FloorPlanPage data={data} tenantId={tenant.id} />
}
