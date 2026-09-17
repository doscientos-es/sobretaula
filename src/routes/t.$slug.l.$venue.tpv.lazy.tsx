import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createLazyFileRoute, getRouteApi } from '@tanstack/react-router'
import { useState } from 'react'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import { AccountOrderWorkspace, AccountPayments, type AccountView } from '@/features/account'
import { CashRegisterPage } from '@/features/cash-register'
import { floorPlanQuery, type FloorPlanData } from '@/features/floor-plan'
import type { MenuCatalog } from '@/features/menu/application/menu'
import {
  posAccountQuery,
  posBoardQuery,
  posManagementQuery,
  posMenuQuery,
  PosTerminalPage,
} from '@/features/pos'
import { getSalesReport, ProductSalesSummary, SalesReportPage } from '@/features/reports'
import { KitchenQueue, type ServiceBoard } from '@/features/service'
import { getZonedWeekBounds } from '@/shared/lib/date/zoned-time'
import { useLocale } from '@/shared/lib/i18n/locale-preference'
import { useLoaderReload } from '@/shared/lib/router/use-loader-reload'

export const Route = createLazyFileRoute('/t/$slug/l/$venue/tpv')({
  component: PosTerminalRoute,
})

const tenantRoute = getRouteApi('/t/$slug')

function PosTerminalRoute() {
  const { tenantMembership } = Route.useRouteContext()
  const { venue, sessionId } = Route.useLoaderData()
  const { tenant } = tenantRoute.useLoaderData()
  const { slug } = Route.useParams()
  const board = useQuery(posBoardQuery({ tenantId: tenant.id, venueId: venue.id }))
  const plan = useQuery(floorPlanQuery(tenant.id, venue.id))
  const account = useQuery({
    ...posAccountQuery({
      tenantId: tenant.id,
      venueId: venue.id,
      sessionId: sessionId ?? '',
    }),
    enabled: Boolean(sessionId),
  })
  const menu = useQuery({
    ...posMenuQuery({ tenantId: tenant.id, venueId: venue.id }),
    enabled: Boolean(sessionId),
  })
  const canManage = ['owner', 'manager'].includes(tenantMembership.role)
  if (board.isPending) return <TenantRoutePending />
  if (board.error) throw board.error
  if (account.error) throw account.error
  const serviceBoard = board.data
  const floorPlan: FloorPlanData = plan.data ?? {
    areas: [],
    elements: [],
    placements: [],
  }
  return (
    <PosTerminalPage
      {...(account.data && tenantMembership.role !== 'host'
        ? menu.data
          ? {
              accountWorkspace: (
                <PosTerminalAccountWorkspace account={account.data} menu={menu.data} />
              ),
            }
          : {}
        : {})}
      board={serviceBoard}
      canAccessAccounts={tenantMembership.role !== 'host'}
      canManageCash={canManage}
      {...(tenantMembership.role !== 'host'
        ? {
            kitchenWorkspace: <PosTerminalKitchenWorkspace board={serviceBoard} />,
          }
        : {})}
      {...(canManage ? { managementWorkspace: <PosTerminalManagementWorkspace /> } : {})}
      slug={slug}
      plan={floorPlan}
      selectedSessionId={sessionId}
      venue={venue.slug}
    />
  )
}

function PosTerminalAccountWorkspace({
  account,
  menu,
}: {
  account: AccountView
  menu: MenuCatalog
}) {
  const { tenantMembership } = Route.useRouteContext()
  const { venue } = Route.useLoaderData()
  const { tenant } = tenantRoute.useLoaderData()
  const queryClient = useQueryClient()
  const reload = useLoaderReload()
  const locale = useLocale(tenant.defaultLocale)
  const refresh = () => {
    void queryClient
      .invalidateQueries({
        queryKey: posAccountQuery({
          sessionId: account.session.id,
          tenantId: tenant.id,
          venueId: venue.id,
        }).queryKey,
      })
      .then(reload)
  }
  return (
    <div className="space-y-4">
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
        onDone={refresh}
        tenantId={tenant.id}
        venueId={venue.id}
      />
    </div>
  )
}

function PosTerminalKitchenWorkspace({ board }: { board: ServiceBoard }) {
  const { venue } = Route.useLoaderData()
  const { tenant } = tenantRoute.useLoaderData()
  const queryClient = useQueryClient()
  const reload = useLoaderReload()
  const refresh = () => {
    void queryClient
      .invalidateQueries({
        queryKey: ['tenant', tenant.id, 'venue', venue.id, 'pos-workspace'],
      })
      .then(reload)
  }
  return (
    <KitchenQueue
      onDone={refresh}
      tenantId={tenant.id}
      tickets={board.kitchenTickets ?? []}
      venueId={venue.id}
    />
  )
}

function PosTerminalManagementWorkspace() {
  const { tenant } = tenantRoute.useLoaderData()
  const { venue } = Route.useLoaderData()
  const queryClient = useQueryClient()
  const reload = useLoaderReload()
  const [period] = useState(() => {
    const bounds = getZonedWeekBounds(new Date(), tenant.timezone)
    return { from: bounds.dayStartIso, to: bounds.dayEndIso }
  })
  const management = useQuery(
    posManagementQuery({ ...period, tenantId: tenant.id, venueId: venue.id }),
  )
  if (management.isPending)
    return (
      <div
        aria-live="polite"
        className="border-border/70 text-muted-foreground rounded-xl border p-6 text-sm"
      >
        Cargando caja e informes…
      </div>
    )
  if (management.error)
    return (
      <div
        aria-live="polite"
        className="border-destructive/40 text-destructive rounded-xl border p-6 text-sm"
      >
        No se ha podido cargar la gestión del turno.
      </div>
    )
  const { history, register, report } = management.data
  const refresh = () => {
    void queryClient
      .invalidateQueries({
        queryKey: posManagementQuery({
          ...period,
          tenantId: tenant.id,
          venueId: venue.id,
        }).queryKey,
      })
      .then(reload)
  }
  return (
    <div className="space-y-6">
      <CashRegisterPage
        history={history.items}
        onDone={refresh}
        register={register ?? null}
        tenantId={tenant.id}
        venueId={venue.id}
      />
      <SalesReportPage
        initialPeriod={period}
        onRange={(from, to) =>
          getSalesReport({
            data: { from, tenantId: tenant.id, to, venueId: venue.id },
          })
        }
        report={report}
        timeZone={tenant.timezone}
      />
      <ProductSalesSummary products={report.productSummary} />
    </div>
  )
}
