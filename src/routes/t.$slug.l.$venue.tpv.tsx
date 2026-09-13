import { createFileRoute, notFound } from '@tanstack/react-router'
import { z } from 'zod'

import { tenantRouteState } from '@/app/tenant-route-loader'
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
import { KitchenQueue, type ServiceBoard } from '@/features/service'
import { loadServiceBoard } from '@/features/service/infrastructure/server/service-board-repository'
import { requireTenantRouteAccess } from '@/features/tenancy/application/tenant-route-access'
import { loadVenueRouteContext } from '@/features/venues'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'
import { createRequestSupabaseClient } from '@/shared/lib/supabase/server/create-server-client'

export const Route = createFileRoute('/t/$slug/l/$venue/tpv')({
  validateSearch: z.object({ sessionId: z.string().uuid().optional() }),
  loaderDeps: ({ search }) => ({ sessionId: search.sessionId }),
  beforeLoad: ({ context }) =>
    requireTenantRouteAccess(context.tenantMembership.role, 'operations'),
  loader: async ({ context, deps, params }) => {
    const routeContext = await loadVenueRouteContext(context.queryClient, params.slug, params.venue)
    if (!routeContext) throw notFound()
    const { tenant, venue } = routeContext
    const data = { tenantId: tenant.id, venueId: venue.id }
    const canManage = ['owner', 'manager'].includes(context.tenantMembership.role)
    const now = new Date()
    const startOfDay = new Date(now)
    startOfDay.setHours(0, 0, 0, 0)
    const [board, menu, management] = await Promise.all([
      loadServiceBoard(createRequestSupabaseClient(context.tenantMembership.accessToken), {
        ...data,
        now,
      }),
      getMenu({ data }),
      canManage
        ? Promise.all([
            getCashRegister({ data }),
            listClosedCashRegisters({ data }),
            getSalesReport({
              data: {
                ...data,
                from: startOfDay.toISOString(),
                to: now.toISOString(),
              },
            }),
          ]).catch(() => undefined)
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
      tenant,
      venue,
    }
  },
  component: PosTerminalRoute,
  ...tenantRouteState,
})

function PosTerminalRoute() {
  const { tenantMembership } = Route.useRouteContext()
  const { account, board, cashHistory, cashRegister, report, venue } = Route.useLoaderData()
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
                history={cashHistory.items}
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
  const { tenantMembership } = Route.useRouteContext()
  const { menu, tenant, venue } = Route.useLoaderData()
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
  const { tenant, venue } = Route.useLoaderData()
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
  history: Awaited<ReturnType<typeof listClosedCashRegisters>>['items']
  register: Awaited<ReturnType<typeof getCashRegister>>
  report: Awaited<ReturnType<typeof getSalesReport>>
}) {
  const { tenant, venue } = Route.useLoaderData()
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
