import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createLazyFileRoute, getRouteApi } from '@tanstack/react-router'

import { TenantRoutePending } from '@/app/tenant-route-loader'
import { AccountOrderWorkspace, AccountPayments, type AccountView } from '@/features/account'
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
        layout="pos"
        locale={locale}
        menu={menu}
        paymentSummary={
          <AccountPayments
            account={account}
            canManageAdjustments={['owner', 'manager'].includes(tenantMembership.role)}
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
