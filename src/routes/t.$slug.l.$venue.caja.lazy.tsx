import { queryOptions, useQuery, useQueryClient } from '@tanstack/react-query'
import { createLazyFileRoute } from '@tanstack/react-router'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import { getCashRegister, listClosedCashRegisters } from '@/features/cash-register'
import { CashRegisterPage } from '@/features/cash-register/ui/cash-register-page'
import { ClosedRegisterSummary } from '@/features/cash-register/ui/closed-register-summary'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/caja')({
  component: CashRoute,
})

function CashRoute() {
  const { tenant, venue } = Route.useLoaderData()
  const queryClient = useQueryClient()
  const cash = useQuery(cashWorkspaceQuery(tenant.id, venue.id))
  const reload = useLoaderReload()
  if (cash.isPending) return <TenantRoutePending />
  if (cash.error) throw cash.error
  const { history, register } = cash.data
  const refresh = () => {
    void queryClient
      .invalidateQueries({ queryKey: cashWorkspaceQuery(tenant.id, venue.id).queryKey })
      .then(reload)
  }
  return (
    <>
      <CashRegisterPage
        register={register}
        history={history.items}
        tenantId={tenant.id}
        venueId={venue.id}
        onDone={refresh}
      />
      {history.items.length > 0 && <ClosedRegisterSummary history={history.items} />}
    </>
  )
}

function cashWorkspaceQuery(tenantId: string, venueId: string) {
  return queryOptions({
    queryFn: async () => {
      const data = { tenantId, venueId }
      const [register, history] = await Promise.all([
        getCashRegister({ data }),
        listClosedCashRegisters({ data }),
      ])
      return { history, register }
    },
    queryKey: ['tenant', tenantId, 'venue', venueId, 'cash-workspace'],
    staleTime: 15_000,
  })
}
