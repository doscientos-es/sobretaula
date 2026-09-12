import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import {
  AccountOrderWorkspace,
  AccountPayments,
  getAccount,
  type AccountView,
} from '@/features/account'
import {
  CashRegisterPage,
  getCashRegister,
  listClosedCashRegisters,
} from '@/features/cash-register'
import { getMenu } from '@/features/menu'
import { PosTerminalPage } from '@/features/pos'
import { getSalesReport, ProductSalesSummary, SalesReportPage } from '@/features/reports'
import { getServiceBoard, KitchenQueue, type ServiceBoard } from '@/features/service'
import { requireTenantRouteAccess } from '@/features/tenancy/application/tenant-route-access'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

export const Route = createFileRoute('/t/$slug/l/$venue/tpv')({
  validateSearch: z.object({ sessionId: z.string().uuid().optional() }),
  loaderDeps: ({ search }) => ({ sessionId: search.sessionId }),
  beforeLoad: ({ context }) =>
    requireTenantRouteAccess(context.tenantMembership.role, 'operations'),
  loader: async ({ context, deps }) => {
    const { tenant, venue } = context
    const canManage = ['owner', 'manager'].includes(context.tenantMembership.role)
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const [board, menu, management] = await Promise.all([
      getServiceBoard({ data: { tenantId: tenant.id, venueId: venue.id } }),
      getMenu({ data: { tenantId: tenant.id, venueId: venue.id } }),
      canManage
        ? Promise.all([
            getCashRegister({ data: { tenantId: tenant.id, venueId: venue.id } }),
            listClosedCashRegisters({ data: { tenantId: tenant.id, venueId: venue.id } }),
            getSalesReport({
              data: {
                from: startOfDay.toISOString(),
                tenantId: tenant.id,
                to: now.toISOString(),
                venueId: venue.id,
              },
            }),
          ])
        : Promise.resolve(undefined),
    ])
    const sessionId =
      context.tenantMembership.role !== 'host' &&
      board.sessions.some((session) => session.id === deps.sessionId)
        ? deps.sessionId
        : undefined
    const account = sessionId
      ? await getAccount({ data: { sessionId, tenantId: tenant.id, venueId: venue.id } })
      : undefined
    return {
      account,
      board,
      cashHistory: management?.[1],
      cashRegister: management?.[0],
      menu,
      report: management?.[2],
    }
  },
  component: PosTerminalRoute,
})

function PosTerminalRoute() {
  const { tenantMembership, venue } = Route.useRouteContext()
  const { account, board, cashHistory, cashRegister, report } = Route.useLoaderData()
  const canManage = ['owner', 'manager'].includes(tenantMembership.role)
  return (
    <PosTerminalPage
      {...(account && tenantMembership.role !== 'host'
        ? { accountWorkspace: <PosTerminalAccountWorkspace account={account} /> }
        : {})}
      board={board}
      canAccessAccounts={tenantMembership.role !== 'host'}
      canManageCash={canManage}
      {...(tenantMembership.role !== 'host'
        ? { kitchenWorkspace: <PosTerminalKitchenWorkspace board={board} /> }
        : {})}
      {...(canManage && cashHistory && report
        ? {
            managementWorkspace: (
              <PosTerminalManagementWorkspace
                history={cashHistory}
                register={cashRegister ?? null}
                report={report}
              />
            ),
          }
        : {})}
      slug={Route.useParams().slug}
      venue={venue.slug}
    />
  )
}

function PosTerminalAccountWorkspace({ account }: { account: AccountView }) {
  const { tenant, tenantMembership, venue } = Route.useRouteContext()
  const { menu } = Route.useLoaderData()
  const reload = useLoaderReload()
  const locale = useLocale(tenant.defaultLocale)
  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_22rem]">
      <span className="sr-only">{`Mesa ${account.session.tableCodes.join(' + ')}`}</span>
      <AccountOrderWorkspace
        account={account}
        locale={locale}
        menu={menu}
        tenantId={tenant.id}
        venueId={venue.id}
      />
      <AccountPayments
        account={account}
        canManageAdjustments={['owner', 'manager'].includes(tenantMembership.role)}
        locale={locale}
        onDone={reload}
        tenantId={tenant.id}
        venueId={venue.id}
      />
    </div>
  )
}

function PosTerminalKitchenWorkspace({ board }: { board: ServiceBoard }) {
  const { tenant, venue } = Route.useRouteContext()
  const reload = useLoaderReload()
  return (
    <KitchenQueue
      onDone={reload}
      tenantId={tenant.id}
      tickets={board.kitchenTickets ?? []}
      venueId={venue.id}
    />
  )
}

function PosTerminalManagementWorkspace({
  history,
  register,
  report,
}: {
  history: Awaited<ReturnType<typeof listClosedCashRegisters>>
  register: Awaited<ReturnType<typeof getCashRegister>>
  report: Awaited<ReturnType<typeof getSalesReport>>
}) {
  const { tenant, venue } = Route.useRouteContext()
  const reload = useLoaderReload()
  return (
    <div className="space-y-6">
      <CashRegisterPage
        history={history}
        onDone={reload}
        register={register}
        tenantId={tenant.id}
        venueId={venue.id}
      />
      <SalesReportPage
        onRange={(from, to) =>
          getSalesReport({ data: { from, tenantId: tenant.id, to, venueId: venue.id } })
        }
        report={report}
      />
      <ProductSalesSummary products={report.productSummary} />
    </div>
  )
}
