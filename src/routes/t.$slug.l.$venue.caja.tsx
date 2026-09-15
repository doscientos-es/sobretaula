import { createFileRoute } from '@tanstack/react-router'

import { getCashRegister, listClosedCashRegisters } from '@/features/cash-register'
import { CashMethodSummary } from '@/features/cash-register/ui/cash-method-summary'
import { CashMovementForm } from '@/features/cash-register/ui/cash-movement-form'
import { CashRegisterPage } from '@/features/cash-register/ui/cash-register-page'
import { ClosedRegisterSummary } from '@/features/cash-register/ui/closed-register-summary'

export const Route = createFileRoute('/t/$slug/l/$venue/caja')({
  loader: async ({ context }) => {
    const { tenant, venue } = context
    const data = { tenantId: tenant.id, venueId: venue.id }
    const [register, history] = await Promise.all([
      getCashRegister({ data }),
      listClosedCashRegisters({ data }),
    ])
    return { history, register, tenant, venue }
  },
  component: CashRoute,
})
function CashRoute() {
  const { history, register, tenant, venue } = Route.useLoaderData()
  const reload = () => window.location.reload()
  return (
    <>
      {register && (
        <>
          <CashMethodSummary salesByMethod={register.salesByMethod} />
          <CashMovementForm
            registerId={register.id as string}
            tenantId={tenant.id}
            venueId={venue.id}
            onDone={reload}
          />
        </>
      )}
      <CashRegisterPage
        register={register}
        history={history.items}
        tenantId={tenant.id}
        venueId={venue.id}
        onDone={reload}
      />
      {history.items.length > 0 && <ClosedRegisterSummary history={history.items} />}
    </>
  )
}
