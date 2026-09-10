import { createFileRoute } from '@tanstack/react-router'
import { getCashRegister, listClosedCashRegisters } from '@/features/cash-register'
import { CashRegisterPage } from '@/features/cash-register/ui/cash-register-page'
import { CashMovementForm } from '@/features/cash-register/ui/cash-movement-form'
import { CashMethodSummary } from '@/features/cash-register/ui/cash-method-summary'
import { ClosedRegisterSummary } from '@/features/cash-register/ui/closed-register-summary'

export const Route = createFileRoute('/t/$slug/l/$venue/caja')({
  loader: async ({ context }) => { const data = { tenantId: context.tenant.id, venueId: context.venue.id }; const [register, history] = await Promise.all([getCashRegister({ data }), listClosedCashRegisters({ data })]); return { register, history } },
  component: CashRoute,
})
function CashRoute() { const { tenant, venue } = Route.useRouteContext(); const { register, history } = Route.useLoaderData(); const reload = () => window.location.reload(); return <>{register && <><CashMethodSummary salesByMethod={register.salesByMethod} /><CashMovementForm registerId={register.id as string} tenantId={tenant.id} venueId={venue.id} onDone={reload} /></>}<CashRegisterPage register={register} history={history} tenantId={tenant.id} venueId={venue.id} onDone={reload} />{history.length > 0 && <ClosedRegisterSummary history={history} />}</> }
