import { Button } from '@doscientos/ui'
import { useQuery } from '@tanstack/react-query'
import { createLazyFileRoute } from '@tanstack/react-router'
import { useSyncExternalStore } from 'react'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import { FloorPlanPage, floorPlanQuery } from '@/features/floor-plan'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/plano')({
  component: FloorPlanRoute,
})

function FloorPlanRoute() {
  const { tenant, venue } = Route.useLoaderData()
  const hydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  )
  const plan = useQuery({
    ...floorPlanQuery(tenant.id, venue.id),
  })
  if (!hydrated || plan.isPending) return <TenantRoutePending />
  if (plan.error) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6" role="alert">
        <p>
          No se ha podido cargar el plano. Reintenta la operación; no se ha creado ninguna zona.
        </p>
        <div className="mt-3">
          <Button onClick={() => void plan.refetch()} type="button" variant="outline">
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  return <FloorPlanPage data={plan.data} tenantId={tenant.id} venueId={venue.id} />
}
