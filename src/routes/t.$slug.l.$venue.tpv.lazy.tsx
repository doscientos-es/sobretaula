import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createLazyFileRoute, getRouteApi } from '@tanstack/react-router'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import { AccountOrderWorkspace, AccountPayments, type AccountView } from '@/features/account'
import { computeAccountTotals, type AccountLine } from '@/features/account/domain/account'
import { floorPlanQuery, type FloorPlanData } from '@/features/floor-plan'
import type { MenuCatalog } from '@/features/menu/application/menu'
import { posAccountQuery, posBoardQuery, posMenuQuery, PosTerminalPage } from '@/features/pos'
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
      slug={slug}
      tenantId={tenant.id}
      plan={floorPlan}
      selectedSessionId={sessionId}
      venue={venue.slug}
      venueId={venue.id}
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
  const accountQueryKey = posAccountQuery({
    sessionId: account.session.id,
    tenantId: tenant.id,
    venueId: venue.id,
  }).queryKey
  const refreshAccountQuery = () => {
    void queryClient.invalidateQueries({ queryKey: accountQueryKey })
  }
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: accountQueryKey }).then(reload)
  }
  const onOptimisticAdd = (line: AccountLine) => {
    queryClient.setQueryData<AccountView | undefined>(accountQueryKey, (current) => {
      if (!current) return current
      const lines = [...current.lines, line]
      return {
        ...current,
        lines,
        totals: computeAccountTotals(lines, current.payments, current.session.discountCents),
      }
    })
    return () => {
      queryClient.setQueryData<AccountView | undefined>(accountQueryKey, (current) => {
        if (!current) return current
        const lines = current.lines.filter((currentLine) => currentLine.id !== line.id)
        return {
          ...current,
          lines,
          totals: computeAccountTotals(lines, current.payments, current.session.discountCents),
        }
      })
    }
  }
  const onOptimisticQuantityChange = (lineIds: readonly string[], quantity: number) => {
    const previous = queryClient.getQueryData<AccountView>(accountQueryKey)
    const ids = new Set(lineIds)
    queryClient.setQueryData<AccountView | undefined>(accountQueryKey, (current) => {
      if (!current) return current
      const groupLines = current.lines.filter((line) => ids.has(line.id))
      const currentQuantity = groupLines.reduce((sum, line) => sum + line.quantity, 0)
      let delta = quantity - currentQuantity
      const reversedIds = [...groupLines].reverse().map((line) => line.id)
      const nextLines = current.lines.map((line) => {
        if (!ids.has(line.id) || delta === 0) return line
        if (delta > 0 && line.id === reversedIds[0]) {
          delta = 0
          return { ...line, quantity: line.quantity + quantity - currentQuantity }
        }
        if (delta < 0) {
          const nextQuantity = line.quantity + delta
          if (nextQuantity > 0) {
            delta = 0
            return { ...line, quantity: nextQuantity }
          }
          delta += line.quantity
          return { ...line, status: 'cancelled' as const }
        }
        return line
      })
      return {
        ...current,
        lines: nextLines,
        totals: computeAccountTotals(nextLines, current.payments, current.session.discountCents),
      }
    })
    return () => queryClient.setQueryData(accountQueryKey, previous)
  }
  const onOptimisticRemove = (lineIds: readonly string[]) => {
    const previous = queryClient.getQueryData<AccountView>(accountQueryKey)
    const ids = new Set(lineIds)
    queryClient.setQueryData<AccountView | undefined>(accountQueryKey, (current) => {
      if (!current) return current
      const lines = current.lines.map((line) =>
        ids.has(line.id) ? { ...line, status: 'cancelled' as const } : line,
      )
      return {
        ...current,
        lines,
        totals: computeAccountTotals(lines, current.payments, current.session.discountCents),
      }
    })
    return () => queryClient.setQueryData(accountQueryKey, previous)
  }

  return (
    <div className="h-full min-h-0">
      <span className="sr-only">{`Mesa ${account.session.tableCodes.join(' + ')}`}</span>
      <AccountOrderWorkspace
        account={account}
        layout="pos"
        locale={locale}
        menu={menu}
        onAccountChange={refreshAccountQuery}
        onOptimisticAdd={onOptimisticAdd}
        onOptimisticRemove={onOptimisticRemove}
        onOptimisticQuantityChange={onOptimisticQuantityChange}
        paymentSummary={
          <AccountPayments
            account={account}
            canManageAdjustments={['owner', 'manager'].includes(tenantMembership.role)}
            compact
            locale={locale}
            onDone={refresh}
            tenantId={tenant.id}
            venueId={venue.id}
          />
        }
        tenantId={tenant.id}
        venueId={venue.id}
      />
    </div>
  )
}
